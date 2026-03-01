import ManagedSettings
import ManagedSettingsUI
import UIKit

class ShieldConfigurationExtension: ShieldConfigurationDataSource {

  private let appGroupSuite = "group.com.quitbite.quitbite"
  private let blockTypeKey = "shield_block_type"

  private func subtitleText(for blockType: String) -> String {
    if blockType == "precau" {
      return "Precautionary mode is protecting your focus right now.\nOpen QuitBite to override."
    }
    return "You've hit your delivery budget for this cycle.\nOpen QuitBite to override."
  }

  private func resolveIcon() -> UIImage? {
    if let appIcon = UIImage(named: "AppIcon60x60") ?? UIImage(named: "AppIcon") {
      return appIcon
    }
    return UIImage(systemName: "flame.fill")
  }

  private func buildConfig() -> ShieldConfiguration {
    let defaults = UserDefaults(suiteName: appGroupSuite)
    let blockType = defaults?.string(forKey: blockTypeKey) ?? "budget"

    let title = ShieldConfiguration.Label(
      text: "Blocked by QuitBite",
      color: UIColor(red: 0.97, green: 0.98, blue: 1.0, alpha: 1.0)
    )

    let subtitle = ShieldConfiguration.Label(
      text: subtitleText(for: blockType),
      color: UIColor(red: 0.78, green: 0.82, blue: 0.91, alpha: 1.0)
    )

    let primaryButton = ShieldConfiguration.Label(
      text: "Open QuitBite",
      color: .white
    )

    let secondaryButton = ShieldConfiguration.Label(
      text: "Keep me blocked",
      color: UIColor(red: 0.66, green: 0.76, blue: 1.0, alpha: 1.0)
    )

    return ShieldConfiguration(
      backgroundBlurStyle: .systemChromeMaterialDark,
      backgroundColor: UIColor(red: 0.05, green: 0.08, blue: 0.16, alpha: 0.98),
      icon: resolveIcon(),
      title: title,
      subtitle: subtitle,
      primaryButtonLabel: primaryButton,
      primaryButtonBackgroundColor: UIColor(red: 0.20, green: 0.46, blue: 0.98, alpha: 1.0),
      secondaryButtonLabel: secondaryButton
    )
  }

  override func configuration(shielding application: Application) -> ShieldConfiguration {
    return buildConfig()
  }

  override func configuration(shielding application: Application, in category: ActivityCategory) -> ShieldConfiguration {
    return buildConfig()
  }

  override func configuration(shielding webDomain: WebDomain) -> ShieldConfiguration {
    return buildConfig()
  }

  override func configuration(shielding webDomain: WebDomain, in category: ActivityCategory) -> ShieldConfiguration {
    return buildConfig()
  }
}
