import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import { Construct } from 'constructs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns'
import { Stack, StackProps } from 'aws-cdk-lib';
import { aws_ecr as ecr } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface DeploymentProps extends StackProps {
  imageArn: string
}

export class DeploymentStack extends Stack {
  public readonly appLoadBalancerDNS: cdk.CfnOutput
  public readonly appPort: number = 80  
  public readonly cloudMapNamespace: string = 'service.internal'

  constructor(scope: Construct, id: string, props: DeploymentProps) {
    super(scope, id, props)

    const vpc = new ec2.Vpc(this, 'AppVPC', {
      maxAzs: 2,
    })

    const cluster = new ecs.Cluster(this, 'ServiceCluster', { vpc })

    cluster.addDefaultCloudMapNamespace({ name: this.cloudMapNamespace })
    
    const imageArn =  props.imageArn
    const appService = this.createAppService(cluster,imageArn)

    this.appLoadBalancerDNS = new cdk.CfnOutput(this, 'AppLoadBalancerDNS', {
      value: appService.loadBalancer.loadBalancerDnsName,
    })    
    
  }
 
  
  private createAppService(cluster: ecs.Cluster, imageArn:string) {   
   
    
      //Add permission to allow task to pull repo
      // the role assumed by the task and its containers
      const taskRole = new iam.Role(this, "task-role", {
        assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
        roleName: "task-role",
        description: "Role that the api task definitions use to run the api code",
      });

      taskRole.attachInlinePolicy(
        new iam.Policy(this, "task-policy", {
          statements: [
            // policies to allow access to other AWS services from within the container 
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [ 
                   "ecr:GetAuthorizationToken",
                   "ecr:BatchCheckLayerAvailability",
                   "ecr:GetDownloadUrlForLayer",
                   "ecr:BatchGetImage"
                 ],
              resources: [ imageArn ],
            }),
          ],
        })
      );

    // Add task
    const appTask = new ecs.FargateTaskDefinition(this, 'app-task', {
      cpu: 512,
      memoryLimitMiB: 2048,
      taskRole: taskRole,
    })

    appTask
      .addContainer('app', {
        image: ecs.ContainerImage.fromEcrRepository(ecr.Repository.fromRepositoryArn(this,"Image", imageArn)),
        essential: true,        
        logging: ecs.LogDrivers.awsLogs({
          streamPrefix: 'AppContainer',
          logRetention: logs.RetentionDays.ONE_DAY,
        }),        
      })
      .addPortMappings({ containerPort: this.appPort, hostPort: this.appPort })             
            
    const appService = new ecsPatterns.NetworkLoadBalancedFargateService(
      this,'app-service',{
        cluster,
        cloudMapOptions: {
          name: 'app',
        },
        cpu: 512,
        desiredCount: 1,
        taskDefinition: appTask,
        memoryLimitMiB: 2048,
        listenerPort: 80,
        publicLoadBalancer: true,
      }
    )

    appService.service.connections.allowFromAnyIpv4(
      ec2.Port.tcp(this.appPort),
      'app-inbound'
    )

    return appService
  }

  
}

