const core = require('@actions/core');
const exec = require('@actions/exec');
const tc = require('@actions/tool-cache');
const cache = require('@actions/cache');
const artifact = require('@actions/artifact');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { HttpClient } = require('@actions/http-client');

/**
 * Fetches the latest Trivy version from GitHub API
 */
async function getLatestTrivyVersion() {
    try {
        const http = new HttpClient('trivy-action-client');
        const response = await http.getJson('https://api.github.com/repos/aquasecurity/trivy/releases/latest');
        return response.result.tag_name.replace('v', '');
    } catch (e) {
        return '0.48.3'; // Fallback
    }
}

/**
 * Installs Trivy binary based on OS and Architecture
 */
async function installTrivy(version) {
    let targetVersion = version === 'latest' ? await getLatestTrivyVersion() : version;
    const platform = os.platform();
    const arch = os.arch();

    let parts = {
        os: platform === 'win32' ? 'Windows' : platform === 'darwin' ? 'macOS' : 'Linux',
        arch: arch === 'x64' ? '64bit' : arch === 'arm64' ? 'ARM64' : '32bit'
    };

    const ext = platform === 'win32' ? '.zip' : '.tar.gz';
    const url = `https://github.com/aquasecurity/trivy/releases/download/v${targetVersion}/trivy_${targetVersion}_${parts.os}-${parts.arch}${ext}`;

    core.info(`Downloading Trivy v${targetVersion} from ${url}`);
    const downloadPath = await tc.downloadTool(url);
    const extractPath = platform === 'win32' ? await tc.extractZip(downloadPath) : await tc.extractTar(downloadPath);
    
    core.addPath(extractPath);
    return targetVersion;
}

async function run() {
    try {
        // 1. Get Inputs
        const scanType = core.getInput('scan-type');
        const scanTarget = core.getInput('scan-target');
        const severity = core.getInput('severity').toUpperCase();
        const exitCodeInput = core.getInput('exit-code');
        const trivyVersion = core.getInput('trivy-version');
        const generateSbom = core.getInput('generate-sbom') === 'true';

        // 2. Install
        await installTrivy(trivyVersion);

        // 3. Setup Caching
        const cachePath = path.join(os.homedir(), '.cache', 'trivy');
        const cacheKey = `trivy-db-${new Date().toISOString().split('T')[0]}`;
        const restoredKey = await cache.restoreCache([cachePath], cacheKey);

        // 4. Prepare Arguments
        // We always output JSON internally so we can parse it for the Summary
        const jsonFile = 'trivy-results.json';
        let args = [scanType, '--format', 'json', '--output', jsonFile];

        if (generateSbom) {
            args.push('--scanners', 'vuln,secret,misconfig');
        }

        args.push('--severity', severity);
        args.push('--exit-code', '0'); // Always 0 here, we handle failure in Node
        args.push(scanTarget);

        // 5. Execute Scan
        core.info(`Starting scan on target: ${scanTarget}`);
        await exec.exec('trivy', args);

        // 6. Parse JSON for Dynamic Summary
        let stats = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 };
        let total = 0;

        if (fs.existsSync(jsonFile)) {
            const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
            if (data.Results) {
                data.Results.forEach(res => {
                    (res.Vulnerabilities || []).forEach(v => {
                        const s = v.Severity.toUpperCase();
                        if (stats.hasOwnProperty(s)) { stats[s]++; total++; }
                    });
                });
            }
        }

        // 7. Generate Job Summary (Fixed Bold Rendering)
        const isClean = total === 0;
        const statusEmoji = isClean ? '✅' : '❌';
        const statusText = isClean ? 'PASSED' : 'FAILED';

        core.summary.addHeading(`${statusEmoji} Trivy Scan ${statusText}`);
        
        // \n\n is required for GitHub Markdown to render bold correctly
        core.summary.addRaw(`\n\n**Scan Result:** ${isClean ? 'No Vulnerabilities Found' : `Found ${total} Vulnerabilities`}\n\n`);
        core.summary.addRaw(`**Target:** \`${scanTarget}\` | **Type:** \`${scanType}\` | **Time:** ${new Date().toUTCString()}\n\n`);
        
        core.summary.addSeparator();

        core.summary.addTable([
            [{data: 'Severity', header: true}, {data: 'Count', header: true}, {data: 'Status', header: true}],
            ['🔴 CRITICAL', stats.CRITICAL.toString(), stats.CRITICAL > 0 ? '❌' : '✅'],
            ['🟠 HIGH', stats.HIGH.toString(), stats.HIGH > 0 ? '❌' : '✅'],
            ['🟡 MEDIUM', stats.MEDIUM.toString(), '—'],
            ['🔵 LOW', stats.LOW.toString(), '—'],
        ]);

        if (isClean) {
            core.summary.addRaw('\n\n✨ **Zero vulnerabilities detected.** Your target meets the required security standards.');
        } else {
            core.summary.addRaw(`\n\n⚠️ **Action Required:** Found ${total} vulnerabilities. Please check the uploaded artifacts for the full report.`);
        }

        await core.summary.write();

        // 8. Handle Artifacts (using newer Client syntax)
        const artifactClient = new artifact.DefaultArtifactClient();
        await artifactClient.uploadArtifact('trivy-reports', [jsonFile], '.');

        // 9. Save DB Cache
        if (!restoredKey) {
            try { await cache.saveCache([cachePath], cacheKey); } catch (e) {}
        }

        // 10. Final Exit Logic
        if (total > 0 && exitCodeInput !== '0') {
            core.setFailed(`Trivy found ${total} vulnerabilities with severity ${severity}.`);
        }

    } catch (error) {
        core.setFailed(`Action failed: ${error.message}`);
    }
}

run();
