# hello-ecs-pipeline
Build a ECS Faregate Service with Application Load Balancer in the workload account using centralized pipeline. 
Please follow this article https://medium.com/p/c273f9ba12d1 for an overview

# To build
npx yarn install
npx cdk synth
npx cdk deploy --all

# To cleanup
npx cdk destroy --all
