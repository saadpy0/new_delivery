import Foundation
import UserNotifications
import UIKit
import React

@objc(NotificationPermissionManager)
class NotificationPermissionManager: NSObject {
  private let overrideOrderPromptId = "quitbite.override.order.prompt"
  private let reminderIdKeywords = ["quitbite", "budget", "cook", "meal", "reminder"]

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

  @objc(scheduleOverrideOrderPrompt:resolver:rejecter:)
  func scheduleOverrideOrderPrompt(
    _ delaySeconds: NSNumber,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let center = UNUserNotificationCenter.current()
    center.removePendingNotificationRequests(withIdentifiers: [overrideOrderPromptId])

    let content = UNMutableNotificationContent()
    content.title = "Quick check-in"
    content.body = "Did you place a delivery order? Log it now in QuitBite to keep tracking accurate."
    content.sound = .default

    let delay = max(1, delaySeconds.doubleValue)
    let trigger = UNTimeIntervalNotificationTrigger(timeInterval: delay, repeats: false)
    let request = UNNotificationRequest(identifier: overrideOrderPromptId, content: content, trigger: trigger)
    center.add(request) { error in
      if let error = error {
        reject("override_prompt_failed", error.localizedDescription, error)
      } else {
        resolve(true)
      }
    }
  }

  @objc(cancelOverrideOrderPrompt:rejecter:)
  func cancelOverrideOrderPrompt(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let center = UNUserNotificationCenter.current()
    center.removePendingNotificationRequests(withIdentifiers: [overrideOrderPromptId])
    resolve(true)
  }

  @objc(cancelAllAppReminders:rejecter:)
  func cancelAllAppReminders(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let center = UNUserNotificationCenter.current()

    center.getPendingNotificationRequests { requests in
      let matchingPendingIds = requests
        .map { $0.identifier }
        .filter { identifier in
          self.reminderIdKeywords.contains { keyword in
            identifier.localizedCaseInsensitiveContains(keyword)
          }
        }

      center.removePendingNotificationRequests(withIdentifiers: matchingPendingIds)

      center.getDeliveredNotifications { notifications in
        let matchingDeliveredIds = notifications
          .map { $0.request.identifier }
          .filter { identifier in
            self.reminderIdKeywords.contains { keyword in
              identifier.localizedCaseInsensitiveContains(keyword)
            }
          }
        center.removeDeliveredNotifications(withIdentifiers: matchingDeliveredIds)
        resolve(true)
      }
    }
  }

  @objc static func requiresMainQueueSetup() -> Bool {
    return false
  }
}
