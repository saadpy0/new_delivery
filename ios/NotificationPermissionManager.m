#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(NotificationPermissionManager, NSObject)
RCT_EXTERN_METHOD(requestAuthorization:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(scheduleOverrideOrderPrompt:(nonnull NSNumber *)delaySeconds resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(cancelOverrideOrderPrompt:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(cancelAllAppReminders:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
@end
