#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PipelineStack } from '../lib/pipeline';
import * as interfaces from '../lib/interfaces';

try {
  var envVars = interfaces.getConfig();
  
    const app = new cdk.App();
    new PipelineStack(app, 'HelloEcsPipelineStack', {     
      env: {
        account: envVars.env.tools.account,
        region: envVars.env.tools.region,
      }
    });
    app.synth();
    
  } catch (error) {
    console.log('catch: ', error)
}
  