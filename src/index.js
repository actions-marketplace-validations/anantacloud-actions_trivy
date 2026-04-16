const core = require('@actions/core');
const exec = require('@actions/exec');
const tc = require('@actions/tool-cache');
const cache = require('@actions/cache');
const os = require('os');
const path = require('path');

async function getTrivy(version) {
    const platform = os.platform();
    const arch = os.arch();
    
    let parts = {
        platform: platform === 'win32' ? 'Windows' : platform === 'darwin' ? 'macOS' : 'Linux',
        arch: arch === 'x64' ? '64bit' : arch === 'arm64' ? 'ARM64' : '32bit'
    };

    const url = `https://github.com/aquasecurity/trivy/releases/download/v${version}/trivy_${version}_${parts.platform}-${parts.parts.arch}.tar.gz`.replace('parts.', '');
    // Correction for specific Trivy naming conventions
    const downloadUrl = `https://github.com/aquasecurity/trivy/releases/download/v${version}/trivy_${version}_${parts.platform}-${parts.arch}${platform === 'win32' ? '.zip' : '.tar.gz'}`;

    core.info(`Downloading Trivy from: ${downloadUrl}`);
    const downloadPath = await tc.downloadTool(downloadUrl);
    const extractPath = platform === 'win32' ? await tc.extractZip(downloadPath) : await tc.extractTar(downloadPath);
    
    return extractPath;
}

async function run() {
    try {
        // 1. Get Inputs
        const scanType = core.getInput('scan-type');
        const scanTarget = core.getInput('scan-target');
        const severity = core.getInput('severity');
        const exitCode = core.getInput('exit-code');
        const ignoreUnfixed = core.getInput('ignore-unfixed') === 'true';
        const version = core.getInput('trivy-version');
        const format = core.getInput('format');

        // 2. Install Trivy
        const trivyDir = await getTrivy(version);
        core.addPath(trivyDir);

        // 3. Setup Caching for Trivy DB
        // The DB is updated frequently; we cache it by date to speed up runs
        const cachePath = path.join(os.homedir(), '.cache', 'trivy');
        const date = new Date().toISOString().split('T')[0];
        const cacheKey = `trivy-db-${date}`;
        const restoredKey = await cache.restoreCache([cachePath], cacheKey);

        if (restoredKey) {
            core.info('Restored Trivy DB from cache.');
        } else {
            core.info('No cache found for Trivy DB, will download during scan.');
        }

        // 4. Build Arguments
        const outputFileName = `trivy-results.${format}`;
        const args = [
            scanType,
            '--severity', severity,
            '--exit-code', exitCode,
            '--format', format,
            '--output', outputFileName,
        ];

        if (ignoreUnfixed) args.push('--ignore-unfixed');
        args.push(scanTarget);

        // 5. Execute Scan
        core.info(`Starting Trivy scan on ${scanTarget}...`);
        const resultExitCode = await exec.exec('trivy', args, { ignoreReturnCode: true });

        // 6. Save Cache (if not restored today)
        if (!restoredKey) {
            try {
                await cache.saveCache([cachePath], cacheKey);
                core.info('Saved Trivy DB to cache.');
            } catch (e) {
                core.warning(`Failed to save cache: ${e.message}`);
            }
        }

        // 7. Create Job Summary
        await core.summary
            .addHeading('Trivy Scan Results')
            .addText(`Scan Type: ${scanType}`)
            .addText(`Target: ${scanTarget}`)
            .addText(`Exit Code: ${resultExitCode}`)
            .write();

        if (resultExitCode !== 0 && exitCode !== '0') {
            core.setFailed(`Trivy found vulnerabilities with severity ${severity}`);
        }

    } catch (error) {
        core.setFailed(`Action failed: ${error.message}`);
    }
}

run();
