# Motion specification

Implemented in `apps/mobile` (React Native `Animated`, native driver). SwiftUI equivalents are given for a native port. Every animation respects **Reduce Motion**: loops stop, transitions become instant, the shimmer stays still.

Shared presets live in `apps/mobile/src/motion.tsx`.

| Preset | Value | SwiftUI |
|---|---|---|
| `SPRING_PRESS` | mass 1, stiffness 300, damping 25 | `.interpolatingSpring(mass: 1, stiffness: 300, damping: 25)` |
| `EASE_REVEAL` | cubic-bezier(0.25, 1, 0.5, 1), 0.4 s | `.timingCurve(0.25, 1, 0.5, 1, duration: 0.4)` |
| `EASE_OUT` | ease-out cubic | `.easeOut` |

## 1. Living global background (ambient loop)

| | |
|---|---|
| Component | `components/OrbitingEarth.tsx` |
| Trigger | Home mounts; pauses when the app is backgrounded |
| Motion | Z rotation from −22° to 338° (one full turn) |
| Timing | 120 s, linear, repeats forever |
| Parallax | Background moves −140 pt over 400 pt of scroll (0.35×), clamped |
| SwiftUI | `.rotationEffect(.degrees(spin))` with `withAnimation(.linear(duration: 120).repeatForever(autoreverses: false)) { spin = 360 }`; pause on `scenePhase != .active` |

## 2. Analyze Location (functional feedback)

| Step | Spec | Code |
|---|---|---|
| Touch down | Scale to 0.96 with `SPRING_PRESS`, light haptic on release | `Pressy scaleTo={0.96}` |
| Touch up | Label opacity 1 → 0 in 0.15 s (ease-out); spinner fades in on the inverse curve | `HomeScreen.start()` |
| Earth zoom | Scale 1.0 → 1.05, 0.7 s ease-out | `OrbitingEarth zoom` |
| Search panel | Settles down 28 pt, scale 0.97, opacity 0.55, 0.4 s `EASE_REVEAL` | Home panel wrapper |
| Results reveal | At 0.26 s, the results sheet rises from the bottom edge, 0.4 s `EASE_REVEAL`; dismiss slides down in 0.32 s; drag down from the top bar to close (threshold 20% or 0.6 velocity) | `StackScreen from="bottom"` |
| Return | Label, Earth and panel spring back to rest with `SPRING_PRESS` | `covered` effect |

SwiftUI: `ButtonStyle` with `.scaleEffect(isPressed ? 0.96 : 1)` and the spring; results as `.sheet` or a custom `.transition(.move(edge: .bottom))` using the reveal curve; `ProgressView()` cross-faded with the label via `.opacity`.

## 3. Gyroscopic crystal shimmer (micro-delight)

| | |
|---|---|
| Component | `components/CrystalShimmer.tsx` (Home Mineral of the Day, Guide hero) |
| Input | Device motion at 30 Hz (`DeviceMotion`, CoreMotion attitude on iOS) |
| Mapping | Roll (gamma) → X; pitch (beta − 0.7 rad resting angle) → Y. ±0.5 rad maps to the full range |
| Smoothing | Low-pass filter, factor 0.18 per sample |
| Overlay | Linear gradient band rotated 24°, white 0% → 20% → 0%, width 55% of the tile, clipped to the tile's continuous corners |
| Travel | X ±75% of tile size, Y ±25% |
| Cap | Peak opacity 20% |
| Web | Browsers do not report rotation through Expo; the band rests at centre |
| SwiftUI | `CMMotionManager.deviceMotionUpdateInterval = 1/30`; `LinearGradient` in an `.overlay` with `.offset(x: roll * k, y: pitch * k)`, `.blendMode(.plusLighter)`, clipped with `.clipShape(.rect(cornerRadius: 22, style: .continuous))` |

## Other motion already in the app

Spring press on all cards and buttons; staggered fade-in for lists (45 ms per item, max 8); count-up statistics (0.7 s ease-out); shimmer skeletons while loading; sliding segmented-control thumb; floating Liquid Glass tab bar lens; right-edge swipe back on pushed screens; haptics for tap, selection, success and warning.
