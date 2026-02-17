import Foundation
import UserNotifications
import UIKit
import React

@objc(NotificationPermissionManager)
class NotificationPermissionManager: NSObject {
  @objc(requestAuthorization:rejecter:)
  func requestAuthorization(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
      if let error = error {
        reject("notification_failed", error.localizedDescription, error)
        return
      }
      DispatchQueue.main.async {
        UIApplication.shared.registerForRemoteNotifications()
      }
      resolve(granted)
    }
  }

  @objc static func requiresMainQueueSetup() -> Bool {
    return false
  }
}
