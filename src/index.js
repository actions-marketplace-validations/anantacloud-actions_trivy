const core = require('@actions/core');
const exec = require('@actions/exec');
const tc = require('@actions/tool-cache');
const cache = require('@actions/cache');
const artifact = require('@actions/artifact');
const os = require('os');
const path = require('path');
const { HttpClient } = require('@actions/http-client');

/**
 * Fetches the latest release version from GitHub API
 */
async function getLatestTrivyVersion() {
    try {
        const http = new HttpClient('trivy-action-client');
        const response = await http.getJson('https://api.github.com/repos/aquasecurity/trivy/releases/latest');
        return response.result.tag_name.replace('v', '');
    } catch (error) {
        core.warning(`Failed to fetch latest version, falling back to 0.48.3. Error: ${error.message}`);
        return '0.48.3';
    }
}

/**
 * Downloads and installs the Trivy binary based on Runner OS and Architecture
 */
async function installTrivy(version) {
    let targetVersion = version === 'latest' ? await getLatestTrivyVersion() : version;
    core.info(`Installing Trivy v${targetVersion}...`);

    const platform = os.platform(); // linux, darwin, win32
    const arch = os.arch();     // x64, arm64

    let parts = {
        os: platform === 'win32' ? 'Windows' : platform === 'darwin' ? 'macOS' : 'Linux',
        arch: arch === 'x64' ? '64bit' : arch === 'arm64' ? 'ARM64' : '32bit'
    };

    const ext = platform === 'win32' ? '.zip' : '.tar.gz';
    const downloadUrl = `https://github.com/aquasecurity/trivy/releases/download/v${targetVersion}/trivy_${targetVersion}_${parts.os}-${parts.arch}${ext}`;

    core.info(`Downloading from: ${downloadUrl}`);
    const downloadPath = await tc.downloadTool(downloadUrl);
    
    let extractPath;
    if (platform === 'win32') {
        extractPath = await tc.extractZip(downloadPath);
    } else {
        extractPath = await tc.extractTar(downloadPath);
    }

    core.addPath(extractPath);
    return targetVersion;
}

async function run() {
    try {
        // 1. Inputs
        const scanType = core.getInput('scan-type'); // fs, image, config
        const scanTarget = core.getInput('scan-target');
        const severity = core.getInput('severity');
        const exitCode = core.getInput('exit-code');
        const format = core.getInput('format');
        const ignoreUnfixed = core.getInput('ignore-unfixed') === 'true';
        const generateSbom = core.getInput('generate-sbom') === 'true';
        const trivyVersion = core.getInput('trivy-version');
        const uploadArtifact = core.getInput('upload-artifact') === 'true';

        // 2. Installation
        await installTrivy(trivyVersion);

        // 3. Database Caching (Speeds up scans by ~2 minutes)
        const cachePath = path.join(os.homedir(), '.cache', 'trivy');
        const cacheKey = `trivy-db-${new Date().toISOString().split('T')[0]}`;
        const restoredKey = await cache.restoreCache([cachePath], cacheKey);

        if (restoredKey) {
            core.info('Vulnerability database restored from cache.');
        }

        // 4. Build Arguments (Fixed SBOM Logic)
        // Command is always the scanType (fs, image). 
        // We use --format cyclonedx to generate SBOMs.
        let args = [scanType];

        const outputFileName = generateSbom 
            ? 'sbom.json' 
            : `trivy-results.${format === 'table' ? 'txt' : format}`;

        if (generateSbom) {
            args.push('--format', 'cyclonedx');
            // Explicitly include scanners to avoid "disables security scanning" warning
            args.push('--scanners', 'vuln,secret,misconfig');
        } else {
            args.push('--format', format);
        }

        args.push('--severity', severity);
        args.push('--exit-code', exitCode);
        args.push('--output', outputFileName);

        if (ignoreUnfixed) args.push('--ignore-unfixed');

        args.push(scanTarget);

        // 5. Run Scan
        core.info(`Running Trivy scan on ${scanTarget}...`);
        const resultExitCode = await exec.exec('trivy', args, { ignoreReturnCode: true });

        // 6. Save Cache
        if (!restoredKey) {
            try {
                await cache.saveCache([cachePath], cacheKey);
            } catch (e) {
                core.warning(`Cache save failed: ${e.message}`);
            }
        }

        // 7. Upload Results as Artifact
        if (uploadArtifact) {
            try {
                const artifactClient = artifact.create();
                await artifactClient.uploadArtifact(
                    'trivy-scan-report', 
                    [outputFileName], 
                    '.'
                );
                core.info('Report uploaded to artifacts.');
            } catch (e) {
                core.warning(`Artifact upload failed: ${e.message}`);
            }
        }

        // 8. Generate Job Summary
        await core.summary
            .addHeading('🛡️ Trivy Security Report')
            .addTable([
                ['Parameter', 'Value'],
                ['Scan Type', scanType],
                ['Target', `\`${scanTarget}\``],
                ['Exit Code', resultExitCode.toString()],
                ['Status', resultExitCode === 0 ? '✅ Passed' : '⚠️ Issues Found']
            ])
            .addRaw(generateSbom ? '📄 SBOM generated: `sbom.json`' : `📄 Report generated: \`${outputFileName}\``)
            .write();

        // 9. Final result
        if (resultExitCode !== 0 && exitCode !== '0') {
            core.setFailed(`Trivy scan failed with exit code ${resultExitCode}. Vulnerabilities found.`);
        }

    } catch (error) {
        core.setFailed(`Action failed: ${error.message}`);
    }
}

run();
