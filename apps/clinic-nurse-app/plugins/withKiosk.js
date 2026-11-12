const { withAndroidManifest, withDangerousMod, AndroidConfig } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const PACKAGE = "online.era365.nurse";

function adminReceiverKt() {
  return `package ${PACKAGE}

import android.app.admin.DeviceAdminReceiver

class AdminReceiver : DeviceAdminReceiver()
`;
}

function installReceiverKt() {
  return `package ${PACKAGE}

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.util.Log

class InstallResultReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)
    val message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE)
    Log.i("Kiosk", "APK install status=$status message=$message")
  }
}
`;
}

function replacedReceiverKt() {
  return `package ${PACKAGE}

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class PackageReplacedReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val action = intent.action
    if (action != Intent.ACTION_MY_PACKAGE_REPLACED && action != Intent.ACTION_BOOT_COMPLETED) return
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return
    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    context.startActivity(launch)
  }
}
`;
}

function deviceAdminXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<device-admin xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-policies />
</device-admin>
`;
}

function ensurePermission(manifest, name) {
  const root = manifest.manifest;
  const list = root["uses-permission"] ?? [];
  if (!list.some((item) => item.$["android:name"] === name)) {
    list.push({ $: { "android:name": name } });
  }
  root["uses-permission"] = list;
}

function withKioskManifest(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    ensurePermission(manifest, "android.permission.RECEIVE_BOOT_COMPLETED");
    ensurePermission(manifest, "android.permission.REQUEST_INSTALL_PACKAGES");
    ensurePermission(manifest, "android.permission.INTERNET");

    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    const activity = app.activity?.find((item) => item.$["android:name"] === ".MainActivity");
    if (activity) {
      activity.$["android:lockTaskMode"] = "if_whitelisted";
      activity.$["android:launchMode"] = "singleTask";
      const filters = activity["intent-filter"] ?? [];
      const hasHome = filters.some((filter) =>
        (filter.category ?? []).some((category) => category.$["android:name"] === "android.intent.category.HOME"),
      );
      if (!hasHome) {
        filters.push({
          action: [{ $: { "android:name": "android.intent.action.MAIN" } }],
          category: [
            { $: { "android:name": "android.intent.category.HOME" } },
            { $: { "android:name": "android.intent.category.DEFAULT" } },
          ],
        });
      }
      activity["intent-filter"] = filters;
    }

    const receivers = app.receiver ?? [];
    function addReceiver(name, extra) {
      if (receivers.some((item) => item.$["android:name"] === name)) return;
      receivers.push({ $: { "android:name": name, "android:exported": "true", ...extra.attrs }, ...extra.body });
    }
    addReceiver(".AdminReceiver", {
      attrs: { "android:permission": "android.permission.BIND_DEVICE_ADMIN" },
      body: {
        "meta-data": [
          { $: { "android:name": "android.app.device_admin", "android:resource": "@xml/device_admin" } },
        ],
        "intent-filter": [
          { action: [{ $: { "android:name": "android.app.action.DEVICE_ADMIN_ENABLED" } }] },
        ],
      },
    });
    addReceiver(".PackageReplacedReceiver", {
      attrs: {},
      body: {
        "intent-filter": [
          {
            action: [
              { $: { "android:name": "android.intent.action.MY_PACKAGE_REPLACED" } },
              { $: { "android:name": "android.intent.action.BOOT_COMPLETED" } },
            ],
          },
        ],
      },
    });
    addReceiver(".InstallResultReceiver", { attrs: {}, body: {} });
    app.receiver = receivers;
    return config;
  });
}

function withKioskFiles(config) {
  return withDangerousMod(config, [
    "android",
    (config) => {
      const root = config.modRequest.platformProjectRoot;
      const javaDir = path.join(root, "app/src/main/java", ...PACKAGE.split("."));
      const xmlDir = path.join(root, "app/src/main/res/xml");
      fs.mkdirSync(javaDir, { recursive: true });
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(path.join(javaDir, "AdminReceiver.kt"), adminReceiverKt());
      fs.writeFileSync(path.join(javaDir, "InstallResultReceiver.kt"), installReceiverKt());
      fs.writeFileSync(path.join(javaDir, "PackageReplacedReceiver.kt"), replacedReceiverKt());
      fs.writeFileSync(path.join(xmlDir, "device_admin.xml"), deviceAdminXml());
      return config;
    },
  ]);
}

module.exports = function withKiosk(config) {
  return withKioskFiles(withKioskManifest(config));
};
