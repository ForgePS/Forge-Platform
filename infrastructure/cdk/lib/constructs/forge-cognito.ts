import * as cognito from "aws-cdk-lib/aws-cognito";
import { Construct } from "constructs";
import type { ForgeEnvironmentConfig } from "../config/environment-schema.js";
import { resourceName } from "../utils/naming.js";

export interface ForgeCognitoProps {
  config: ForgeEnvironmentConfig;
}

export class ForgeCognito extends Construct {
  readonly userPool: cognito.UserPool;
  readonly academyClient: cognito.UserPoolClient;
  readonly rmsClient: cognito.UserPoolClient;
  readonly creatorClient: cognito.UserPoolClient;
  readonly industrialClient: cognito.UserPoolClient;
  readonly departmentClient: cognito.UserPoolClient;
  readonly studentClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: ForgeCognitoProps) {
    super(scope, id);
    const { config } = props;

    this.userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: resourceName(config, "cognito", "users"),
      signInAliases: { email: true },
      selfSignUpEnabled: config.cognito.selfSignUpEnabled,
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      mfa: cognito.Mfa.OPTIONAL,
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      standardAttributes: {
        email: { required: true, mutable: true },
      },
    });

    const clientProps = {
      generateSecret: false,
      authFlows: {
        userSrp: true,
        userPassword: false,
      },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
        callbackUrls: config.cognito.callbackUrls,
        logoutUrls: config.cognito.logoutUrls,
      },
      preventUserExistenceErrors: true,
    };

    this.academyClient = this.userPool.addClient("AcademyWeb", {
      ...clientProps,
      userPoolClientName: resourceName(config, "cognito", "academy-web"),
    });
    this.rmsClient = this.userPool.addClient("RmsWeb", {
      ...clientProps,
      userPoolClientName: resourceName(config, "cognito", "rms-web"),
    });
    this.creatorClient = this.userPool.addClient("CreatorConsole", {
      ...clientProps,
      userPoolClientName: resourceName(config, "cognito", "creator-console"),
    });
    this.industrialClient = this.userPool.addClient("IndustrialWeb", {
      ...clientProps,
      userPoolClientName: resourceName(config, "cognito", "industrial-web"),
    });
    this.departmentClient = this.userPool.addClient("DepartmentPortal", {
      ...clientProps,
      userPoolClientName: resourceName(config, "cognito", "department-portal"),
    });
    this.studentClient = this.userPool.addClient("StudentPortal", {
      ...clientProps,
      userPoolClientName: resourceName(config, "cognito", "student-portal"),
    });

    this.userPool.addDomain("Domain", {
      cognitoDomain: {
        domainPrefix: `forge-${config.environmentName}-${config.account.slice(-6)}`,
      },
    });
  }
}
