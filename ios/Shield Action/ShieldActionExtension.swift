import Foundation
import ManagedSettings
import UserNotifications

class ShieldActionExtension: ShieldActionDelegate {

  private func handlePrimary(completionHandler: @escaping (ShieldActionResponse) -> Void) {
    let defaults = UserDefaults(suiteName: "group.com.quitbite.quitbite")
    defaults?.set(true, forKey: "pendingOverride")
    defaults?.synchronize()

    let content = UNMutableNotificationContent()
    content.title = "QuitBite"
    content.body = "Tap here to open QuitBite and start your override flow."
    content.sound = .default
    content.userInfo = ["action": "override"]

    let request = UNNotificationRequest(
      identifier: "quitbite-override",
      content: content,
      trigger: nil
    )

    UNUserNotificationCenter.current().add(request) { _ in
      completionHandler(.close)
    }
  }

  override func handle(
    action: ShieldAction,
    for application: ApplicationToken,
    completionHandler: @escaping (ShieldActionResponse) -> Void
  ) {
    switch action {
    case .primaryButtonPressed:
      handlePrimary(completionHandler: completionHandler)
    case .secondaryButtonPressed:
      completionHandler(.close)
    @unknown default:
      completionHandler(.close)
    }
  }

  override func handle(
    action: ShieldAction,
    for webDomain: WebDomainToken,
    completionHandler: @escaping (ShieldActionResponse) -> Void
  ) {
    switch action {
    case .primaryButtonPressed:
      handlePrimary(completionHandler: completionHandler)
    case .secondaryButtonPressed:
      completionHandler(.close)
    @unknown default:
      completionHandler(.close)
    }
  }

  override func handle(
    action: ShieldAction,
    for category: ActivityCategoryToken,
    completionHandler: @escaping (ShieldActionResponse) -> Void
  ) {
    switch action {
    case .primaryButtonPressed:
      handlePrimary(completionHandler: completionHandler)
    case .secondaryButtonPressed:
      completionHandler(.close)
    @unknown default:
      completionHandler(.close)
    }
  }
}
