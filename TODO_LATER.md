# TODO Later

- [ ] Fix shield "Open QuitBite" button notification — notification not firing from ShieldActionExtension. Debug and ensure UNUserNotificationCenter works from the extension sandbox. May need to request notification permission from the extension or use a different approach.
- [ ] Simplify blocking modes — replace soft/hard + flexible/strict with a single 3-level picker: Gentle (block only over budget, easy override), Moderate (always block, medium friction), Strict (always block, full friction pipeline).
- [ ] Blocker sheet scroll fix — schedule UI is hidden at the bottom of the blocker sheet. Wrap sheet content in ScrollView or move schedule to its own section/sheet.
- [ ] Verify subscription sync shows correct product ID and price in TestFlight/production. Xcode StoreKit sandbox returns monthly product ID even for yearly purchases (known sandbox bug).
- [ ] Fix Google and Apple auth flow issues (stabilize sign-in/sign-up, provider config, and callback/session handling).
- [ ] Add onboarding question(s) about user goals and what they enjoy doing; use those answers to generate personalized opportunity-cost messaging.


testing :

- ONB-004 
- PAY-002

block screen, notifs

schedules time

weekly reset, sunday bar 

welcome page on force restart. 


support details. 