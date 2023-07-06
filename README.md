# hello-ecs-pipeline
* Build a ECS Faregate Service with Application Load Balancer in the workload account using centralized pipeline. 
* Modify config/config.yaml file to add your AWS account and region.
* Please follow this article https://medium.com/p/c273f9ba12d1 for details

# To build
npx yarn install
npx cdk synth
npx cdk deploy --all

# To cleanup
npx cdk destroy --all
