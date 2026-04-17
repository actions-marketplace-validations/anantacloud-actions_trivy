# 🛡️ Ultimate Trivy Vulnerability Scanner

[![Build Status](https://img.shields.io/github/actions/workflow/status/anantacloud-actions/trivy/.github/workflows/main.yml?branch=main&style=for-the-badge)](https://github.com/anantacloud-actions/trivy/actions)
[![Marketplace](https://img.shields.io/badge/Marketplace-Ultimate--Trivy-blue?logo=github&style=for-the-badge)](https://github.com/marketplace/actions/ultimate-trivy-scanner)
[![GitHub stars](https://img.shields.io/github/stars/anantacloud-actions/trivy?style=for-the-badge&color=gold)](https://github.com/anantacloud-actions/trivy/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

**Scan faster. Secure smarter.** 

This is a **high-performance, Node.js-based** GitHub Action for [Trivy](https://github.com/aquasecurity/trivy). Unlike standard container-based actions, this runs directly on the runner VM, offering **lightning-fast startup times**, **intelligent database caching**, and **clean Job Summaries**.

---

## 🚀 Why choose this over the official action?

| Feature | Official Trivy Action | This Ultimate Action |
| :--- | :---: | :---: |
| **Startup Speed** | 🐢 Slow (Pulls Docker Image) | ⚡ Instant (Node.js Native) |
| **Database Caching** | ❌ Manual Setup | ✅ Automatic (Daily Cache) |
| **UX** | Console Logs only | ✅ Rich Job Summaries |
| **Architecture** | x64 Only | ✅ x64 & ARM64 Support |
| **Audit Ready** | ❌ Manual | ✅ Auto-uploads Artifacts |

---

## ✨ Key Features

- ⚡ **Lightning Fast:** Built with Node 20, bypassing heavy container pulls.
- 📦 **Smart Caching:** Automatically caches the Trivy Database (DB) to save minutes on every run.
- 📊 **Rich Summaries:** Generates a clean security overview directly on your GitHub Actions summary page.
- 🛡️ **Security Tab Integration:** Full SARIF support to show vulnerabilities in your PR "Files Changed" tab.
- 📜 **SBOM Generation:** Create CycloneDX or SPDX bill-of-materials with a single flag.
- 🛠️ **Compliance Ready:** Support for CIS Benchmarks, NSA, and more.

---

## 🛠️ Quick Start

### Basic Filesystem Scan
Add this to your `.github/workflows/security.yml`:

```yaml
- name: 🛡️ Run Security Scan
  uses: anantacloud-actions/trivy@v1
  with:
    scan-type: 'fs'
    severity: 'HIGH,CRITICAL'
```

---

## 📊 Job Summaries
Don't dig through logs! This action generates a professional summary at the end of every run.

### Example Output:
> ### 🛡️ Trivy Security Report
> **Target:** `.` | **Type:** `fs`
> 
> | Severity | Count | Fixed |
> | -------- | ----- | ----- |
> | 🔴 CRITICAL | 2 | 2 |
> | 🟠 HIGH | 5 | 3 |
> 
> ✅ **No vulnerabilities found with current threshold.** (or ⚠️ **Action failed due to 7 vulnerabilities**)

---

## ⚙️ Configuration

### Inputs

| Input | Description | Default |
| :--- | :--- | :--- |
| `scan-type` | Type of scan: `fs`, `image`, `config`, `sbom` | `fs` |
| `scan-target` | Target to scan (path `.` or image name) | `.` |
| `severity` | Severities (`LOW,MEDIUM,HIGH,CRITICAL`) | `HIGH,CRITICAL` |
| `exit-code` | Exit code when vulnerabilities are found (`1` to fail) | `0` |
| `format` | Output format: `table`, `json`, `sarif` | `table` |
| `trivy-version` | Specific version or `latest` | `latest` |
| `upload-artifact` | Automatically upload the report as a workflow artifact | `true` |

---

## ⭐ Support & Adoption
If you find this action useful, please consider giving it a ⭐ **Star** on GitHub! 

---

## 📜 License
Distributed under the **MIT License**.
