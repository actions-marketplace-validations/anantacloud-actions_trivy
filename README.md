# 🛡️ Ultimate Trivy Vulnerability Scanner

[![Marketplace](https://img.shields.io/badge/Marketplace-Ultimate--Trivy-blue?logo=github&style=for-the-badge)](https://github.com/marketplace/actions/ultimate-trivy-scanner)
[![GitHub stars](https://img.shields.io/github/stars/your-username/trivy-node-action?style=for-the-badge&color=gold)](https://github.com/anantacloud-actions/trivy/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

**Scan faster. Secure smarter.** 

This is a **high-performance, Node.js-based** GitHub Action for [Trivy](https://github.com/aquasecurity/trivy). Unlike standard container-based actions, this runs directly on the runner VM, offering **lightning-fast startup times**, **intelligent database caching**, and **beautiful job summaries**.

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
- 📦 **Smart Caching:** Automatically caches the Trivy Vulnerability Database (DB) to save 2-3 minutes per run.
- 📊 **Rich Summaries:** Generates a clean security overview directly on your GitHub Actions summary page.
- 🛡️ **Security Tab Integration:** Full SARIF support to show vulnerabilities in your PR "Files Changed" tab.
- 📜 **SBOM Generation:** Create CycloneDX or SPDX bill-of-materials with a single flag.
- 🏗️ **Compliance Ready:** Support for CIS Benchmarks, NSA, and more.
- 🛠️ **VEX Support:** Filter out false positives using Vulnerability Exploitability eXchange files.

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

### Advanced Docker Image Scan (with SARIF)
Scan an image and upload results to the GitHub Security tab:

```yaml
- name: 🐳 Scan Container Image
  uses: anantacloud-actions/trivy@v1
  with:
    scan-type: 'image'
    scan-target: 'my-app:latest'
    format: 'sarif'
    exit-code: '1' # Fail the build if vulnerabilities found

- name: 📤 Upload results to Security Tab
  if: always()
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: 'trivy-results.sarif'
```

---

## ⚙️ Configuration

### Inputs

| Input | Description | Default |
| :--- | :--- | :--- |
| `scan-type` | Type of scan: `fs`, `image`, `config`, `rootfs`, `sbom` | `fs` |
| `scan-target` | Target to scan (path `.` or image name `nginx:latest`) | `.` |
| `severity` | Severities to include (`LOW,MEDIUM,HIGH,CRITICAL`) | `HIGH,CRITICAL` |
| `exit-code` | Exit code when vulnerabilities are found (`1` to fail build) | `0` |
| `format` | Output format: `table`, `json`, `sarif` | `table` |
| `trivy-version` | Specific version or `latest` | `latest` |
| `ignore-unfixed` | Ignore vulnerabilities without a fixed version | `false` |
| `compliance` | Scan for compliance: `docker-1.6.0`, `k8s-nsa`, etc. | `""` |
| `upload-artifact` | Automatically upload the report as a workflow artifact | `true` |
| `generate-sbom` | Generate a CycloneDX SBOM instead of a scan | `false` |

---

## 📊 Job Summaries
Don't dig through logs! This action generates a professional summary at the end of every run, showing you exactly what was found at a glance.

<img width="600" alt="GitHub Summary Example" src="https://user-images.githubusercontent.com/6231039/211516240-5a9e695d-79e0-4054-9988-750d4f3b8900.png">

---

## 🤝 Contributing
Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## ⭐ Support
If you find this action useful, please consider giving it a ⭐ **Star** on GitHub! It helps more people discover the project and keeps us motivated to add new features.

---

## 📜 License
Distributed under the **MIT License**. See `LICENSE` for more information.

---
*Maintained by [Your Name/Org](https://github.com/your-username)*
