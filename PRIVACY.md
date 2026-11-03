# Privacy Policy

Last updated: 2026-11-03

Nico Ambient is a browser extension that adds ambient lighting around videos on Nico Nico Douga watch pages (`https://www.nicovideo.jp/watch/...`). This policy describes the information the extension handles.

## Information the extension handles

Nico Ambient does not collect, transmit, sell, or share personal information. It does not include analytics, advertising, or telemetry.

The extension stores only its settings (whether ambient lighting is enabled, brightness, and spread) in the browser's extension-local storage. These settings stay in the user's browser and are not sent to the project owner or to Nico Ambient servers. Uninstalling the extension removes its locally stored settings according to the browser's extension storage behavior.

To render the effect, the extension reads video pixels locally in the page and draws the sampled colors around the player. Video frames are processed in the browser and are not uploaded or retained by Nico Ambient.

## Permissions and access

The `storage` permission is used to save and restore the settings described above. The extension's content script runs on Nico Nico Douga pages so it can find the video player and render the effect. It does not access unrelated websites.

## Third-party services

Nico Ambient does not contact project-operated servers. Installing or updating the extension through a browser's extension store is subject to that store provider's own privacy policy and practices.

## Changes and contact

This policy may be updated when the extension's behavior changes. Updates will be published in this repository with a revised date. For privacy questions, open a GitHub issue without including sensitive personal information. For security vulnerabilities, use the private reporting instructions in [SECURITY.md](SECURITY.md).
