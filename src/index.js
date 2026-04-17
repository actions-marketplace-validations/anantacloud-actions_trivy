const core = require('@actions/core');
const exec = require('@actions/exec');
const tc = require('@actions/tool-cache');
const cache = require('@actions/cache');
const artifact = require('@actions/artifact');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { HttpClient } = require('@actions/http-client');

async function getLatestTrivyVersion() {
    try {
        const http = new HttpClient('trivy-action-client');
        const response = await http.getJson('https://api.github.com/repos/aquasecurity/trivy/releases/latest');
        return response.result.tag_name.replace('v', '');
    } catch (e) { return '0.48.3'; }
}

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
    const downloadPath = await tc.downloadTool(url);
    const extractPath = platform === 'win32' ? await tc.extractZip(downloadPath) : await tc.extractTar(downloadPath);
    core.addPath(extractPath);
}

async function run() {
    try {
        const scanType = core.getInput('scan-type');
        const scanTarget = core.getInput('scan-target');
        const severity = core.getInput('severity');
        const exitCodeInput = core.getInput('exit-code');
        const trivyVersion = core.getInput('trivy-version');

        await installTrivy(trivyVersion);

        // Define internal JSON file for parsing, regardless of user preference
        const jsonFile = 'trivy-results.json';
        
        let args = [
            scanType,
            '--format', 'json',
            '--output', jsonFile,
            '--severity', severity,
            '--exit-code', '0', // We handle the exit code manually after parsing
            scanTarget
        ];

        // 1. Execute Scan
        core.info(`Scanning ${scanTarget}...`);
        await exec.exec('trivy', args);

        // 2. Parse Results for Summary
        let summaryData = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 };
        let totalVulns = 0;

        if (fs.existsSync(jsonFile)) {
            const rawData = fs.readFileSync(jsonFile, 'utf8');
            const json = JSON.parse(rawData);

            // Trivy JSON structure: Results[] -> Vulnerabilities[]
            if (json.Results) {
                for (const result of json.Results) {
                    if (result.Vulnerabilities) {
                        for (const v of result.Vulnerabilities) {
                            const sev = v.Severity.toUpperCase();
                            if (summaryData.hasOwnProperty(sev)) {
                                summaryData[sev]++;
                                totalVulns++;
                            }
                        }
                    }
                }
            }
        }

        // 3. Build the Job Summary (Run-time)
        const summary = core.summary
            .addHeading('🛡️ Trivy Scan Report')
            .addRaw(`**Target:** \`${scanTarget}\` | **Type:** \`${scanType}\` | **Total:** \`${totalVulns}\``)
            .addTable([
                [{data: 'Severity', header: true}, {data: 'Count', header: true}],
                ['🔴 CRITICAL', summaryData.CRITICAL.toString()],
                ['🟠 HIGH', summaryData.HIGH.toString()],
                ['🟡 MEDIUM', summaryData.MEDIUM.toString()],
                ['🔵 LOW', summaryData.LOW.toString()],
                ['⚪ UNKNOWN', summaryData.UNKNOWN.toString()],
            ]);

        if (totalVulns > 0) {
            summary.addRaw(`⚠️ Found ${totalVulns} vulnerabilities.`);
        } else {
            summary.addRaw(`✅ No vulnerabilities found for selected severities.`);
        }
        
        await summary.write();

        // 4. Handle Artifacts
        const artifactClient = new artifact.DefaultArtifactClient();
        await artifactClient.uploadArtifact('trivy-results', [jsonFile], '.');

        // 5. Final Exit Logic
        if (totalVulns > 0 && exitCodeInput !== '0') {
            core.setFailed(`Scan failed: Found ${totalVulns} vulnerabilities with severity ${severity}.`);
        }

    } catch (error) {
        core.setFailed(`Action failed: ${error.message}`);
    }
}

run();
