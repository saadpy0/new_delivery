import ManagedSettings

class ShieldActionExtension: ShieldActionDelegate {

  override func handle(
    action: ShieldAction,
    for application: ApplicationToken,
    completionHandler: @escaping (ShieldActionResponse) -> Void
  ) {
    switch action {
    case .primaryButtonPressed:
      openQuitBite()
      completionHandler(.close)
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
      openQuitBite()
      completionHandler(.close)
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
      openQuitBite()
      completionHandler(.close)
    case .secondaryButtonPressed:
      completionHandler(.close)
    @unknown default:
      completionHandler(.close)
    }
  }

  private func openQuitBite() {
    // Use shared UserDefaults to signal the main app to open override flow
    let defaults = UserDefaults(suiteName: "group.com.quitbite.quitbite")
    defaults?.set(true, forKey: "pendingOverride")
    defaults?.synchronize()

    // Open the main app via URL scheme
    if let url = URL(string: "quitbite://override") {
      // Extensions can't call UIApplication.shared.open directly,
      // but we set the flag above so the app knows to show override on launch.
      // The .close response will return user to home screen where they can tap QuitBite.
      _ = url // suppress unused warning
    }
  }
}
