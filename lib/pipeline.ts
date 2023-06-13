import * as cdk from 'aws-cdk-lib';
import { DeploymentStack } from './deployment';
import { BuildSpec } from 'aws-cdk-lib/aws-codebuild';
import { AssetImage, AwsLogDriver, Secret } from 'aws-cdk-lib/aws-ecs';
import { CodePipeline, CodeBuildStep, ManualApprovalStep, StageDeployment, Wave } from 'aws-cdk-lib/pipelines';
import { CodeCommitSource } from './source-repository';
import { Construct } from 'constructs';
import {  StackProps, Stage, StageProps } from 'aws-cdk-lib';
import * as ecrAssets from 'aws-cdk-lib/aws-ecr-assets';
import * as ecrdeploy from 'cdk-ecr-deployment';
import { aws_ecr as ecr } from 'aws-cdk-lib';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam'
import * as iam from 'aws-cdk-lib/aws-iam';
import * as interfaces from '../lib/interfaces';

export class PipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)
      
    const appName = this.node.tryGetContext('appName');
    const repoName = appName.toLowerCase()
    const accountId = props?.env?.account
    const accountRegion = props?.env?.region    

    //Get the configuration
    try {
      var envVars = interfaces.getConfig();    
    } catch (error) {
      console.log('catch: ', error)
    }
    
    //CodeCommit
    const source = new CodeCommitSource(this, 'Source', { 
      repositoryName: appName
    });
    
    //Docker Repository
    const repository = new ecr.Repository(this, 'DockerRepository', {
      repositoryName: repoName,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const imageArn = `arn:aws:ecr:${accountRegion}:${accountId}:repository/${repoName}`

    //Image
    const appAsset = new ecrAssets.DockerImageAsset(this, 'app', {
        directory: './app',
        file: 'Dockerfile',
    })       
    const imageUri = `${accountId}.dkr.ecr.${accountRegion}.amazonaws.com/${repoName}:${appAsset.imageTag}`

    // Build new image with custom uri
    new ecrdeploy.ECRDeployment(this, 'DeployDockerImage', {
      src: new ecrdeploy.DockerImageName(appAsset.imageUri),
      dest: new ecrdeploy.DockerImageName(`${imageUri}`),
    });
  

    // set repository permission       
    repository.addToResourcePolicy(
      new PolicyStatement({
        principals: [
          new iam.AnyPrincipal
        ],
        actions: [
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchCheckLayerAvailability",
          "ecr:BatchGetImage",          
        ],
        conditions: {
          StringEquals: {
            "aws:PrincipalOrgID": [ envVars.organization.id ] 
          }
        }
      })      
    );

    // Build
    const synthAction = new CodeBuildStep('Synth', {       
        input: source.codePipelineSource,
        partialBuildSpec: BuildSpec.fromObject({
          phases: {
            install: {
              'runtime-versions': {
                nodejs: 16,
              },
            },
            build: {             
              commands: ['yarn install --frozen-lockfile', 'npm run build' ],
            },
          },
          version: '0.2',
        }),
        commands: [],
      });
  
      //pipeline
      const pipeline = new CodePipeline(this, appName, {
        pipelineName: appName,
        synth: synthAction,
        dockerEnabledForSynth: true,
        crossAccountKeys: true,
        publishAssetsInParallel: false,   
      });

     
      

        // Stage - Dev
        const dev_stage = pipeline.addStage( 
          new Deployment(this, `${appName}-dev`, imageArn, {       
            env: {
              account: envVars.env.dev.account,
              region: envVars.env.dev.region,
            },
          }
          )             
        );    
        

        const test_stage = pipeline.addStage( 
          new Deployment(this, `${appName}-test`, imageArn, {       
            env: {
              account: envVars.env.test.account,
              region: envVars.env.test.region,
            },
          }
          )             
        );
        
        test_stage.addPost(new ManualApprovalStep('PromoteToProd'),) 

        const prod_stage = pipeline.addStage( 
          new Deployment(this, `${appName}-prod`, imageArn, {       
            env: {
              account: envVars.env.prod.account,
              region: envVars.env.prod.region,           
            },
          }
          )             
        );   
    
  
  }
}  

// Multiple deployment stages
class Deployment extends Stage {
  constructor(scope: Construct,  id: string, imageArn: string, props?: StageProps) {
    super(scope, id, props)
 
    new DeploymentStack(this, id, {           
      imageArn: imageArn      
    })  
  }  
} 
