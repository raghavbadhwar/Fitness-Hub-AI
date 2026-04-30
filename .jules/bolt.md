## 2024-04-30 - Debouncing text input to prevent main thread blocks
**Learning:** React Native's main thread can get blocked significantly when filtering large lists during rapid text input (like search bars). React state updates trigger expensive recalculations immediately.
**Action:** Implement and use a standard \`useDebounce\` hook to delay filtering calculations until the user stops typing, ensuring 60fps typing responsiveness.
