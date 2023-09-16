import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';


export class DailyContentEmailerCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here

    const vpc = new ec2.Vpc(this, 'MyVpc', {
      maxAzs: 2,  // Default is all AZs in the region
    });

    const db = new rds.DatabaseInstance(this, 'Instance', {
      engine: rds.DatabaseInstanceEngine.MYSQL,  // or any other engine you prefer
      credentials: rds.Credentials.fromGeneratedSecret('admin'),
      vpc,
      removalPolicy: cdk.RemovalPolicy.DESTROY,  // Use with caution. It will delete the database instance on stack deletion.
    });

    const websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Use with caution: This deletes the bucket when your CDK stack is deleted.
      websiteIndexDocument: 'index.html',  // Serves index.html when accessing the root of the bucket
      publicReadAccess: false, // This will make the bucket's contents publicly accessible. Be cautious about the data you store here.
    });

    const userRegistrationFunction = new lambda.Function(this, 'UserRegistrationFunction', {
      runtime: lambda.Runtime.NODEJS_14_X,  
      code: lambda.Code.fromAsset('lambdas/userRegistration'),  
      handler: 'index.handler',
      environment: {
        DB_ENDPOINT: db.dbInstanceEndpointAddress,
        DB_NAME: 'dailycontentemailercdkstack-instancec1063a87-irgjdeptiwnu',  
      },
      vpc: vpc,  
    });

    const emailDeliveryFunction = new lambda.Function(this, 'EmailDeliveryFunction', {
      runtime: lambda.Runtime.NODEJS_14_X,  
      code: lambda.Code.fromAsset('lambdas/emailDelivery'),  
      handler: 'index.handler',
      environment: {
        DB_ENDPOINT: db.dbInstanceEndpointAddress,
        DB_NAME: 'dailycontentemailercdkstack-instancec1063a87-irgjdeptiwnu',  
      },
      vpc: vpc,
    });

    const getContentFromDBFunction = new lambda.Function(this, 'getContentFromDBFunction', {
      runtime: lambda.Runtime.NODEJS_14_X,
      code: lambda.Code.fromAsset('lambdas/getContentFromDB'),
      handler: 'index.handler',
      environment: {
        DB_ENDPOINT: db.dbInstanceEndpointAddress,
        DB_NAME: 'dailycontentemailercdkstack-instancec1063a87-irgjdeptiwnu',
      },
      vpc: vpc,
    });
    

    db.grantConnect(userRegistrationFunction);
    db.grantConnect(emailDeliveryFunction);
    db.grantConnect(getContentFromDBFunction);

    const api = new apigateway.RestApi(this, 'DailyContentEmailerAPI', {
      description: 'Endpoint for the Daily Content Emailer App',
    }); 
    
    const userRegistrationIntegration = new apigateway.LambdaIntegration(userRegistrationFunction);
    api.root.addMethod('POST', userRegistrationIntegration);
    
    const emailDeliveryIntegration = new apigateway.LambdaIntegration(emailDeliveryFunction);
    api.root.addResource('email').addMethod('POST', emailDeliveryIntegration);
    
    const contentGenerationIntegration = new apigateway.LambdaIntegration(getContentFromDBFunction);
    api.root.addResource('get-content').addMethod('GET', contentGenerationIntegration);

  }
}
