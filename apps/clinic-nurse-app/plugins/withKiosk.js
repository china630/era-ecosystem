const { withAndroidManifest, withAppBuildGradle, withDangerousMod, AndroidConfig } = require("@expo/config-plugins");
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
import expo.modules.kiosk.KioskBootstrap

class InstallResultReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)
    val message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE)
    val apkPath = intent.getStringExtra(KioskBootstrap.EXTRA_APK_PATH)
    val kind = intent.getStringExtra(KioskBootstrap.EXTRA_INSTALL_KIND)
      ?: KioskBootstrap.INSTALL_KIND_NURSE
    Log.i("Kiosk", "APK install status=$status kind=$kind message=$message apk=$apkPath")
    try {
      KioskBootstrap.deleteUpdateApk(context, apkPath)
    } catch (err: Exception) {
      Log.e("Kiosk", "deleteUpdateApk after install status failed", err)
    }
    if (kind == KioskBootstrap.INSTALL_KIND_COVER) {
      KioskBootstrap.onCoverInstallFinished()
      Log.i("Kiosk", "cover install finished status=$status — MainActivity not relaunched")
      return
    }
    if (status == PackageInstaller.STATUS_SUCCESS) {
      try {
        KioskBootstrap.launchMain(context, "InstallResultReceiver.SUCCESS.nurse")
      } catch (err: Exception) {
        Log.e("Kiosk", "InstallResultReceiver relaunch failed", err)
      }
    }
  }
}
`;
}

function replacedReceiverKt() {
  return `package ${PACKAGE}

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import expo.modules.kiosk.KioskBootstrap

class PackageReplacedReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val action = intent.action
    Log.i("Kiosk", "PackageReplacedReceiver action=$action")
    if (action != Intent.ACTION_MY_PACKAGE_REPLACED && action != Intent.ACTION_BOOT_COMPLETED) {
      return
    }
    try {
      KioskBootstrap.setPausedByAdmin(context, false)
      KioskBootstrap.scrubUpdateArtifacts(context)
      KioskBootstrap.dismissCover(context)
      KioskBootstrap.launchMain(context, "PackageReplacedReceiver.$action")
    } catch (err: Exception) {
      Log.e("Kiosk", "PackageReplacedReceiver relaunch failed action=$action", err)
      throw err
    }
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
    ensurePermission(manifest, "android.permission.SCHEDULE_EXACT_ALARM");
    ensurePermission(manifest, "android.permission.USE_EXACT_ALARM");

    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    app.$["android:resizeableActivity"] = "false";
    app.$["android:supportsPictureInPicture"] = "false";
    app.$["android:enableOnBackInvokedCallback"] = "false";
    const activity = app.activity?.find((item) => item.$["android:name"] === ".MainActivity");
    if (activity) {
      activity.$["android:lockTaskMode"] = "if_whitelisted";
      activity.$["android:launchMode"] = "singleTask";
      activity.$["android:resizeableActivity"] = "false";
      activity.$["android:supportsPictureInPicture"] = "false";
      activity.$["android:enableOnBackInvokedCallback"] = "false";
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
    // MY_PACKAGE_REPLACED must not declare <data> / scheme — otherwise the replace intent is dropped.
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
    addReceiver(".InstallResultReceiver", { attrs: { "android:exported": "true" }, body: {} });
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

function withApkName(config) {
  return withAppBuildGradle(config, (config) => {
    let text = config.modResults.contents.replace(/\n\s*archivesBaseName = "Clinic-Nurse"/, "");
    if (!text.includes('archivesName = "Clinic-Nurse"')) {
      text += '\nbase {\n    archivesName = "Clinic-Nurse"\n}\n';
    }
    config.modResults.contents = text;
    return config;
  });
}

module.exports = function withKiosk(config) {
  return withApkName(withKioskFiles(withKioskManifest(config)));
};
