import Foundation
import FamilyControls
import DeviceActivity
import ManagedSettings
import SwiftUI
import React

@available(iOS 16.0, *)
private let settingsStore = ManagedSettingsStore()

@available(iOS 16.0, *)
private var savedSelection = FamilyActivitySelection()

private let selectionKey = "ScreenTimeManager_selection"
private let sharedSuiteName = "group.com.quitbite.quitbite"
private let sharedSelectionKey = "shared_selection"
private let sharedBlockTypeKey = "shield_block_type"

@objc(ScreenTimeManager)
class ScreenTimeManager: NSObject {

  // MARK: - Request Screen Time authorization

  @objc(requestAuthorization:rejecter:)
  func requestAuthorization(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    if #available(iOS 16.0, *) {
      Task {
        do {
          try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
          resolve(true)
        } catch {
          reject("authorization_failed", error.localizedDescription, error)
        }
      }
    } else {
      reject("unsupported", "Screen Time requires iOS 16 or later.", nil)
    }
  }

  // MARK: - Present the FamilyActivityPicker so user can choose apps to block

  @objc(selectApps:rejecter:)
  func selectApps(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    if #available(iOS 16.0, *) {
      DispatchQueue.main.async {
        guard let rootVC = UIApplication.shared.connectedScenes
          .compactMap({ ($0 as? UIWindowScene)?.keyWindow?.rootViewController })
          .first else {
          reject("no_root_vc", "Could not find root view controller.", nil)
          return
        }

        let pickerView = AppPickerView(
          selection: savedSelection,
          onSave: { newSelection in
            savedSelection = newSelection
            self.persistSelection(newSelection)
            let count = (newSelection.applicationTokens.count)
              + (newSelection.categoryTokens.count)
              + (newSelection.webDomainTokens.count)
            resolve(["count": count])
          },
          onCancel: {
            resolve(["count": NSNull(), "cancelled": true])
          }
        )

        let hostingVC = UIHostingController(rootView: pickerView)
        hostingVC.modalPresentationStyle = .pageSheet
        rootVC.present(hostingVC, animated: true)
      }
    } else {
      reject("unsupported", "Screen Time requires iOS 16 or later.", nil)
    }
  }

  // MARK: - Block the selected apps using ManagedSettingsStore

  @objc(blockApps:rejecter:)
  func blockApps(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    if #available(iOS 16.0, *) {
      let selection = savedSelection
      let appTokens = selection.applicationTokens
      let categoryTokens = selection.categoryTokens

      if appTokens.isEmpty && categoryTokens.isEmpty {
        reject("no_selection", "No apps selected to block. Please select apps first.", nil)
        return
      }

      settingsStore.shield.applications = appTokens.isEmpty ? nil : appTokens
      settingsStore.shield.applicationCategories = categoryTokens.isEmpty
        ? nil
        : .specific(categoryTokens)

      let defaults = UserDefaults(suiteName: sharedSuiteName)
      if defaults?.string(forKey: sharedBlockTypeKey) == nil {
        defaults?.set("budget", forKey: sharedBlockTypeKey)
      }
      defaults?.synchronize()

      resolve(true)
    } else {
      reject("unsupported", "Screen Time requires iOS 16 or later.", nil)
    }
  }

  // MARK: - Unblock all apps (clear the shield)

  @objc(unblockApps:rejecter:)
  func unblockApps(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    if #available(iOS 16.0, *) {
      settingsStore.shield.applications = nil
      settingsStore.shield.applicationCategories = nil
      let defaults = UserDefaults(suiteName: sharedSuiteName)
      defaults?.set("none", forKey: sharedBlockTypeKey)
      defaults?.synchronize()
      resolve(true)
    } else {
      reject("unsupported", "Screen Time requires iOS 16 or later.", nil)
    }
  }

  @objc(setShieldContext:resolver:rejecter:)
  func setShieldContext(
    _ blockType: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let normalized = blockType.lowercased()
    guard normalized == "budget" || normalized == "precau" || normalized == "none" else {
      reject("invalid_block_type", "Unsupported block type: \(blockType)", nil)
      return
    }

    let defaults = UserDefaults(suiteName: sharedSuiteName)
    defaults?.set(normalized, forKey: sharedBlockTypeKey)
    defaults?.synchronize()
    resolve(true)
  }

  // MARK: - Get current block status and selection count

  @objc(getBlockStatus:rejecter:)
  func getBlockStatus(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    if #available(iOS 16.0, *) {
      let isBlocking = settingsStore.shield.applications != nil
        || settingsStore.shield.applicationCategories != nil
      let selection = savedSelection
      let count = selection.applicationTokens.count
        + selection.categoryTokens.count
        + selection.webDomainTokens.count
      resolve([
        "isBlocking": isBlocking,
        "selectedCount": count,
      ])
    } else {
      reject("unsupported", "Screen Time requires iOS 16 or later.", nil)
    }
  }

  // MARK: - Persistence helpers

  @available(iOS 16.0, *)
  private func persistSelection(_ selection: FamilyActivitySelection) {
    do {
      let data = try JSONEncoder().encode(selection)
      UserDefaults.standard.set(data, forKey: selectionKey)
      // Also persist to shared App Group so extensions can access it
      UserDefaults(suiteName: sharedSuiteName)?.set(data, forKey: sharedSelectionKey)
    } catch {
      print("ScreenTimeManager: failed to persist selection – \(error)")
    }
  }

  @available(iOS 16.0, *)
  static func loadPersistedSelection() {
    guard let data = UserDefaults.standard.data(forKey: selectionKey) else { return }
    do {
      savedSelection = try JSONDecoder().decode(FamilyActivitySelection.self, from: data)
      // Sync to shared App Group
      UserDefaults(suiteName: sharedSuiteName)?.set(data, forKey: sharedSelectionKey)
    } catch {
      print("ScreenTimeManager: failed to load selection – \(error)")
    }
  }

  @objc static func requiresMainQueueSetup() -> Bool {
    return true
  }
}

// MARK: - SwiftUI wrapper for FamilyActivityPicker

@available(iOS 16.0, *)
struct AppPickerView: View {
  @State var selection: FamilyActivitySelection
  var onSave: (FamilyActivitySelection) -> Void
  var onCancel: () -> Void
  @Environment(\.dismiss) private var dismiss

  var body: some View {
    NavigationView {
      FamilyActivityPicker(selection: $selection)
        .navigationTitle("Select Apps to Block")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
          ToolbarItem(placement: .cancellationAction) {
            Button("Cancel") {
              dismiss()
              onCancel()
            }
          }
          ToolbarItem(placement: .confirmationAction) {
            Button("Save") {
              dismiss()
              onSave(selection)
            }
            .fontWeight(.semibold)
          }
        }
    }
  }
}
