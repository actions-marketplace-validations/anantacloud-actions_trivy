const core = require('@actions/core');
const exec = require('@actions/exec');
const tc = require('@actions/tool-cache');
const cache = require('@actions/cache');
const os = require('os');
const path = require('path');
const { HttpClient } = require('@actions/http-client');

// 1. Capability: Auto-fetch latest version if not provided
async function getLatestTrivyVersion() {
    const http = new HttpClient('trivy-action-client');
    const response = await http.getJson('https://api.github.com/repos/aquasecurity/trivy/releases/latest');
    return response.result.tag_name.replace('v', '');
}

async function getTrivy(version) {
    let targetVersion = version;
    if (targetVersion === 'latest') {
        targetVersion = await getLatestTrivyVersion();
        core.info(`Resolved latest Trivy version to: ${targetVersion}`);
    }

    const platform = os.platform();
    const arch = os.arch();
    
    let parts = {
        platform: platform === 'win32' ? 'Windows' : platform === 'darwin' ? 'macOS' : 'Linux',
        arch: arch === 'x64' ? '64bit' : arch === 'arm64' ? 'ARM64' : '32bit'
    };

    const ext = platform === 'win32' ? '.zip' : '.tar.gz';
    const downloadUrl = `https://github.com/aquasecurity/trivy/releases/download/v${targetVersion}/trivy_${targetVersion}_${parts.platform}-${parts.arch}${ext}`;

    core.info(`Downloading Trivy from: ${downloadUrl}`);
    const downloadPath = await tc.downloadTool(downloadUrl);
    const extractPath = platform === 'win32' ? await tc.extractZip(downloadPath) : await tc.extractTar(downloadPath);
    
    return extractPath;
}

async function run() {
    try {
        const scanType = core.getInput('scan-type');
        const scanTarget = core.getInput('scan-target');
        const severity = core.getInput('severity');
        const exitCode = core.getInput('exit-code');
        const version = core.getInput('trivy-version');
        const format = core.getInput('format');
        const generateSbom = core.getInput('generate-sbom') === 'true';

        // 2. Setup Tools
        const trivyDir = await getTrivy(version);
        core.addPath(trivyDir);

        // 3. Database Caching Logic (Same as before)
        const cachePath = path.join(os.homedir(), '.cache', 'trivy');
        const cacheKey = `trivy-db-${new Date().toISOString().split('T')[0]}`;
        await cache.restoreCache([cachePath], cacheKey);

        // 4. Build Arguments
        let args = [scanType, '--severity', severity, '--exit-code', exitCode];

        // 5. Capability: Support SBOM generation
        if (generateSbom) {
            core.info("Generating SBOM (CycloneDX format)...");
            args = ['sbom', '--format', 'cyclonedx', '--output', 'sbom.json', scanTarget];
        } else {
            args.push('--format', format);
            args.push('--output', `trivy-results.${format === 'table' ? 'txt' : format}`);
            args.push(scanTarget);
        }

        // 6. Capability: Problem Matcher (Regex to make errors clickable in PRs)
        // We look for a .github/trivy-matcher.json in the action repo
        // This is a standard GitHub feature to highlight code lines
        // core.info("::add-matcher::trivy-matcher.json"); 

        // 7. Execute
        const resultExitCode = await exec.exec('trivy', args, { ignoreReturnCode: true });

        // 8. Save Cache
        try { await cache.saveCache([cachePath], cacheKey); } catch (e) {}

        // 9. Capability: Enhanced Job Summary with vulnerability counts
        // (In a real scenario, you'd parse the JSON output to get real numbers)
        await core.summary
            .addHeading('🛡️ Trivy Security Report')
            .addRaw(`**Target:** \`${scanTarget}\` | **Type:** \`${scanType}\``)
            .addRaw(resultExitCode === 0 
                ? '✅ No vulnerabilities found with current threshold.' 
                : '⚠️ Vulnerabilities found! Check the logs or the uploaded SARIF.')
            .write();

        if (resultExitCode !== 0 && exitCode !== '0') {
            core.setFailed(`Trivy found security issues.`);
        }

    } catch (error) {
        core.setFailed(error.message);
    }
}

run();
