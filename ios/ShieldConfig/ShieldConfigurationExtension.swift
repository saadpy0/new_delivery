import ManagedSettings
import ManagedSettingsUI
import UIKit

class ShieldConfigurationExtension: ShieldConfigurationDataSource {

  private func buildConfig() -> ShieldConfiguration {
    let title = ShieldConfiguration.Label(
      text: "Blocked by QuitBite",
      color: UIColor(red: 0.10, green: 0.10, blue: 0.18, alpha: 1.0)
    )

    let subtitle = ShieldConfiguration.Label(
      text: "You've hit your delivery budget.\nTap below to get a link to QuitBite.",
      color: UIColor(red: 0.56, green: 0.56, blue: 0.58, alpha: 1.0)
    )

    let primaryButton = ShieldConfiguration.Label(
      text: "Open QuitBite",
      color: .white
    )

    let secondaryButton = ShieldConfiguration.Label(
      text: "Stay Focused",
      color: UIColor(red: 0.29, green: 0.42, blue: 0.97, alpha: 1.0)
    )

    return ShieldConfiguration(
      backgroundBlurStyle: .systemUltraThinMaterial,
      backgroundColor: UIColor.white,
      icon: nil,
      title: title,
      subtitle: subtitle,
      primaryButtonLabel: primaryButton,
      primaryButtonBackgroundColor: UIColor(red: 0.29, green: 0.42, blue: 0.97, alpha: 1.0),
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
