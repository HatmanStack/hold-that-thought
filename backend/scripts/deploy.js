import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { spawn, execSync, execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEPLOY_CONFIG_PATH = path.join(__dirname, '..', '.deploy-config.json');
const SAM_CONFIG_PATH = path.join(__dirname, '..', 'samconfig.toml');
const FRONTEND_ENV_PATH = path.join(__dirname, '..', '..', '.env');

export function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

export function question(rl, query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function checkPrerequisites() {
  console.log('Checking prerequisites...');
  try {
    execSync('aws sts get-caller-identity', { stdio: 'ignore' });
  } catch (e) {
    console.error('Error: AWS CLI not configured or missing credentials. Run "aws configure".');
    process.exit(1);
  }

  try {
    execSync('sam --version', { stdio: 'ignore' });
  } catch (e) {
    console.error('Error: SAM CLI not installed.');
    process.exit(1);
  }
}

export async function loadOrPromptConfig(rl) {
  let config = {};
  if (fs.existsSync(DEPLOY_CONFIG_PATH)) {
    try {
      config = JSON.parse(fs.readFileSync(DEPLOY_CONFIG_PATH, 'utf8'));
      console.log('Loaded configuration from .deploy-config.json');
    } catch (e) {
      console.warn('Failed to parse .deploy-config.json, prompting for new config.');
    }
  }

  const defaults = {
    region: 'us-east-1',
    stackName: 'hold-that-thought',
    allowedOrigins: '*',
    userProfilesTable: 'HoldThatThought-UserProfiles',
    commentsTable: 'HoldThatThought-Comments',
    messagesTable: 'HoldThatThought-Messages',
    conversationMembersTable: 'HoldThatThought-ConversationMembers',
    reactionsTable: 'HoldThatThought-Reactions',
    rateLimitTable: 'HoldThatThought-RateLimit',
    mediaBucket: 'hold-that-thought-media',
    profilePhotosBucket: 'hold-that-thought-profile-photos'
  };

  if (!config.region) {
    const input = await question(rl, `Enter AWS Region [${defaults.region}]: `);
    config.region = input.trim() || defaults.region;
  }

  if (!config.stackName) {
    const input = await question(rl, `Enter Stack Name [${defaults.stackName}]: `);
    config.stackName = input.trim() || defaults.stackName;
  }

  if (!config.allowedOrigins) {
    const input = await question(rl, `Enter Allowed Origins (CORS) [${defaults.allowedOrigins}]: `);
    config.allowedOrigins = input.trim() || defaults.allowedOrigins;
  }

  if (!config.userProfilesTable) {
    const input = await question(rl, `Enter User Profiles Table [${defaults.userProfilesTable}]: `);
    config.userProfilesTable = input.trim() || defaults.userProfilesTable;
  }

  if (!config.commentsTable) {
    const input = await question(rl, `Enter Comments Table [${defaults.commentsTable}]: `);
    config.commentsTable = input.trim() || defaults.commentsTable;
  }

  if (!config.messagesTable) {
    const input = await question(rl, `Enter Messages Table [${defaults.messagesTable}]: `);
    config.messagesTable = input.trim() || defaults.messagesTable;
  }

  if (!config.conversationMembersTable) {
    const input = await question(rl, `Enter Conversation Members Table [${defaults.conversationMembersTable}]: `);
    config.conversationMembersTable = input.trim() || defaults.conversationMembersTable;
  }

  if (!config.reactionsTable) {
    const input = await question(rl, `Enter Reactions Table [${defaults.reactionsTable}]: `);
    config.reactionsTable = input.trim() || defaults.reactionsTable;
  }

  if (!config.rateLimitTable) {
    const input = await question(rl, `Enter Rate Limit Table [${defaults.rateLimitTable}]: `);
    config.rateLimitTable = input.trim() || defaults.rateLimitTable;
  }

  if (!config.mediaBucket) {
    const input = await question(rl, `Enter Media Bucket [${defaults.mediaBucket}]: `);
    config.mediaBucket = input.trim() || defaults.mediaBucket;
  }

  if (!config.profilePhotosBucket) {
    const input = await question(rl, `Enter Profile Photos Bucket [${defaults.profilePhotosBucket}]: `);
    config.profilePhotosBucket = input.trim() || defaults.profilePhotosBucket;
  }

  fs.writeFileSync(DEPLOY_CONFIG_PATH, JSON.stringify(config, null, 2));
  return config;
}

export function generateSamConfig(config) {
  const overrides = [
    `AllowedOrigins=${config.allowedOrigins}`,
    `UserProfilesTable=${config.userProfilesTable}`,
    `CommentsTable=${config.commentsTable}`,
    `MessagesTable=${config.messagesTable}`,
    `ConversationMembersTable=${config.conversationMembersTable}`,
    `ReactionsTable=${config.reactionsTable}`,
    `RateLimitTable=${config.rateLimitTable}`,
    `MediaBucket=${config.mediaBucket}`,
    `ProfilePhotosBucket=${config.profilePhotosBucket}`
  ];

  const parameterOverrides = overrides.join(' ');

  const content = `version = 0.1
[default.deploy.parameters]
stack_name = "${config.stackName}"
region = "${config.region}"
capabilities = "CAPABILITY_IAM"
parameter_overrides = "${parameterOverrides}"
resolve_s3 = true
`;
  fs.writeFileSync(SAM_CONFIG_PATH, content);
  console.log('Generated samconfig.toml');
  return content;
}

async function buildAndDeploy() {
  console.log('Building SAM application...');
  try {
    execSync('sam build', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  } catch (e) {
    console.error('Build failed.');
    process.exit(1);
  }

  console.log('Deploying SAM application...');
  return new Promise((resolve, reject) => {
    const deploy = spawn('sam', ['deploy', '--no-confirm-changeset', '--no-fail-on-empty-changeset'], {
      cwd: path.join(__dirname, '..'),
      shell: true
    });

    let stdoutData = '';

    deploy.stdout.on('data', (data) => {
      const str = data.toString();
      process.stdout.write(str);
      stdoutData += str;
    });

    deploy.stderr.on('data', (data) => {
      process.stderr.write(data);
    });

    deploy.on('error', (err) => {
      console.error(`Failed to spawn sam process: ${err.message}`);
      reject(new Error(`Failed to start deployment: ${err.message}`));
    });

    deploy.on('close', (code) => {
      if (code !== 0) {
        console.error(`Deployment failed with code ${code}`);
        reject(new Error('Deployment failed'));
      } else {
        resolve(stdoutData);
      }
    });
  });
}

async function getStackOutputs(stackName, region) {
  try {
    const result = execFileSync('aws', [
      'cloudformation',
      'describe-stacks',
      '--stack-name',
      stackName,
      '--region',
      region,
      '--query',
      'Stacks[0].Outputs',
      '--output',
      'json'
    ]);
    return JSON.parse(result.toString());
  } catch (e) {
    console.error('Failed to get stack outputs');
    return [];
  }
}

function updateFrontendEnv(apiUrl) {
  let envContent = '';
  if (fs.existsSync(FRONTEND_ENV_PATH)) {
    envContent = fs.readFileSync(FRONTEND_ENV_PATH, 'utf8');
  }

  const lines = envContent.split('\n');
  let found = false;
  const newLines = lines.map(line => {
    if (line.startsWith('URARA_API_URL=')) {
      found = true;
      return `URARA_API_URL=${apiUrl}`;
    }
    return line;
  });

  if (!found) {
    newLines.push(`URARA_API_URL=${apiUrl}`);
  }

  const tmpPath = FRONTEND_ENV_PATH + '.tmp';
  fs.writeFileSync(tmpPath, newLines.join('\n'));
  fs.renameSync(tmpPath, FRONTEND_ENV_PATH);
  console.log(`Updated frontend .env with API URL: ${apiUrl}`);
}

async function main() {
  await checkPrerequisites();
  const rl = createInterface();
  const config = await loadOrPromptConfig(rl);
  rl.close();

  generateSamConfig(config);

  try {
    await buildAndDeploy();
  } catch (e) {
    process.exit(1);
  }

  console.log('Deployment complete. Fetching outputs...');
  const outputs = await getStackOutputs(config.stackName, config.region);
  const apiUrlOutput = outputs.find(o => o.OutputKey === 'ApiUrl');

  if (apiUrlOutput) {
    updateFrontendEnv(apiUrlOutput.OutputValue);
  } else {
    console.warn('Could not find ApiUrl in stack outputs.');
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
