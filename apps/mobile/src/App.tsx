import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { Camera, Compass, Folder, Home, UserRound, X } from "lucide-react-native";
import { Brand, Button, Header } from "./components/Primitives";
import { AnalysisScreen, Explore, ReportScreen } from "./ExploreScreens";
import GlassFill from "./components/Glass";
import OrbitingEarth from "./components/OrbitingEarth";
import PlaceSearch from "./components/PlaceSearch";
import HomeScreen from "./HomeScreen";
import ZonesScreen from "./ZonesScreen";
import IdentifyScreen from "./IdentifyScreen";
import MineralGuide from "./MineralGuide";
import { FadeIn, haptic, StackScreen, TabFade } from "./motion";
import { Profile, ProjectDetail, ProjectsList } from "./ProjectScreens";
import { Scanner } from "./ScanScreen";
import { api, authenticate, post, signOut } from "./services/api";
import { projectsWithCache } from "./services/outbox";
import { WorkspaceProvider, useWorkspace } from "./state/Workspace";
import { type, useTheme } from "./theme";
import type { Location, Project, Tab } from "./types";

const native = Platform.OS !== "web";
// Hide covered screens from screen readers with each platform's own prop.
const hidden = (on: boolean) =>
  Platform.OS === "web"
    ? { "aria-hidden": on }
    : { accessibilityElementsHidden: on, importantForAccessibility: on ? ("no-hide-descendants" as const) : ("auto" as const) };
type Route =
  | { name: "analysis"; from?: "bottom" }
  | { name: "report" }
  | { name: "guide"; query: string }
  | { name: "project" }
  | { name: "identify"; suggested: string[] }
  | { name: "zones" };
const TABS = [
  ["Home", Home],
  ["Explore", Compass],
  ["Scan", Camera],
  ["Projects", Folder],
  ["Profile", UserRound],
] as const;

/** Floating glass tab bar with a lens that slides to the selected tab. */
function TabBar({
  tab,
  onChange,
  onDark,
}: {
  tab: Tab;
  onChange: (t: Tab) => void;
  /** Dark glass over the planet, map and camera. */
  onDark?: boolean;
}) {
  const theme = useTheme();
  const dark = theme.dark || !!onDark;
  const c = onDark
    ? {
        ...theme.c,
        glass: "rgba(22,26,24,0.6)",
        glassBorder: "rgba(255,255,255,0.14)",
        fill: "rgba(255,255,255,0.14)",
        label: "#FFFFFF",
        tint: "#5FD39A",
      }
    : theme.c;
  const [width, setWidth] = useState(0);
  const index = TABS.findIndex(([t]) => t === tab);
  const x = useRef(new Animated.Value(index)).current;
  useEffect(() => {
    Animated.spring(x, { toValue: index, speed: 18, bounciness: 7, useNativeDriver: native }).start();
  }, [index]);
  const seg = width ? (width - 12) / TABS.length : 0;
  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[styles.nav, { backgroundColor: c.glass, borderColor: c.glassBorder }]}
    >
      <GlassFill intensity={70} dark={dark} solid={onDark ? "#161A18" : theme.c.card} />
      {!!seg && (
        <Animated.View
          style={{
            position: "absolute",
            top: 6,
            bottom: 6,
            left: 6,
            width: seg,
            borderRadius: 26,
            backgroundColor: c.fill,
            transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, seg] }) }],
          }}
        />
      )}
      {TABS.map(([name, Icon]) => {
        const on = tab === name;
        // Scan is the app's headline action: the iOS 27 "prominent" tab.
        const prominent = name === "Scan";
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            aria-selected={on}
            accessibilityLabel={name}
            key={name}
            onPress={() => {
              if (!on) haptic.select();
              onChange(name);
            }}
            style={styles.navItem}
          >
            {prominent ? (
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: c.tint,
                  // Same footprint as a 22 pt icon, so every label sits on one line.
                  marginVertical: -6,
                }}
              >
                <Icon size={19} color={onDark ? "#03140B" : theme.c.onTint} strokeWidth={2.4} />
              </View>
            ) : (
              <Icon size={22} color={on ? c.tint : c.label} strokeWidth={on ? 2.4 : 1.8} />
            )}
            <Text style={{ ...type.caption2, fontWeight: "600", color: on ? c.tint : c.label }}>
              {name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Shell() {
  const w = useWorkspace();
  const win = useWindowDimensions();
  // The whole globe fits: most of the width, never more than half the height.
  const globe = Math.min(win.width - 48, win.height * 0.48, 460);
  const { c, ui, dark } = useTheme();
  const [stack, setStack] = useState<Route[]>([]),
    [auth, setAuth] = useState(false),
    [register, setRegister] = useState(false),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [projects, setProjects] = useState<Project[]>([]),
    [project, setProject] = useState<Project | null>(null),
    [name, setName] = useState(""),
    [saving, setSaving] = useState(false);
  const top = stack[stack.length - 1];
  const push = (r: Route) => setStack((s) => [...s, r]);
  const pop = () => {
    setStack((s) => s.slice(0, -1));
    setError("");
  };
  const home = (tab?: Tab) => {
    setStack([]);
    if (tab) w.setTab(tab);
  };
  const openGuide = (query = "") => push({ name: "guide", query });
  const identify = (suggested: string[] = []) => push({ name: "identify", suggested });
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (stack.length) {
        pop();
        return true;
      }
      if (w.tab !== "Home") {
        w.setTab("Home");
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [stack.length, w.tab]);
  useEffect(() => {
    if (w.user && w.tab === "Projects") {
      setBusy(true);
      projectsWithCache()
        .then(setProjects)
        .catch((e) => setError(e.message))
        .finally(() => setBusy(false));
    } else if (!w.user) setProjects([]);
  }, [w.user, w.tab, saving, stack.length]);
  const analyze = (point?: Location, from?: "bottom") => {
    if (point) w.selectLocation(point);
    if (top?.name !== "analysis") push({ name: "analysis", from });
    void w.analyze(point);
  };
  const save = () => {
    if (!w.user) {
      setAuth(true);
      return;
    }
    setName(w.hasPlace ? w.location.name.split(",")[0] + " exploration" : "");
    setSaving(true);
    setError("");
  };
  async function login() {
    setBusy(true);
    setError("");
    try {
      w.setUser(await authenticate(register ? "register" : "login", email, password));
      setAuth(false);
      setPassword("");
      haptic.success();
      void w.welcome();
    } catch (e) {
      haptic.warning();
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveProject() {
    setBusy(true);
    setError("");
    try {
      const p = await post<Project>("/projects", {
        name,
        location: w.location,
        analysis_id: w.analysis ? w.runId : null,
        polygon: w.polygon.length >= 3 ? [...w.polygon, w.polygon[0]] : null,
      });
      setProjects((old) => [p, ...old]);
      setSaving(false);
      haptic.success();
      home("Projects");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const overDark =
    !w.welcomed || (!stack.length && (w.tab === "Home" || w.tab === "Explore" || w.tab === "Scan"));
  const screen = (r: Route, back: () => void) => {
    switch (r.name) {
      case "analysis":
        return (
          <AnalysisScreen
            back={back}
            save={save}
            report={() => push({ name: "report" })}
            zones={() => push({ name: "zones" })}
            guide={openGuide}
          />
        );
      case "zones":
        return <ZonesScreen back={back} />;
      case "identify":
        return <IdentifyScreen back={back} suggested={r.suggested} open={openGuide} />;
      case "report":
        return <ReportScreen back={back} />;
      case "guide":
        return (
          <MineralGuide
            initialQuery={r.query}
            back={back}
            signIn={() => setAuth(true)}
            explore={() => home("Explore")}
            identify={() => identify()}
          />
        );
      case "project":
        return project ? (
          <ProjectDetail
            project={project}
            setProject={setProject}
            back={back}
            guide={openGuide}
            analyze={() => analyze(project.location)}
            addSample={() => {
              w.selectLocation(project.location);
              home("Scan");
            }}
            deleted={() => {
              setProjects((old) => old.filter((p) => p.id !== project.id));
              setProject(null);
              home();
            }}
          />
        ) : null;
    }
  };
  return (
    <SafeAreaView
      style={[
        styles.frame,
        {
          backgroundColor:
            !stack.length && w.welcomed && w.tab === "Home" ? "#06150F" : overDark ? "#000" : c.bg,
        },
      ]}
    >
      <StatusBar barStyle={overDark || dark ? "light-content" : "dark-content"} />
      {!w.ready ? (
        <View style={styles.center}>
          <Brand large light />
          <ActivityIndicator color="#DAB557" />
        </View>
      ) : !w.welcomed ? (
        <View style={{ flex: 1, backgroundColor: "#031310" }}>
          <LinearGradient
            colors={["#020B09", "#031310", "#041713"]}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 24 }}>
            <View
              style={{
                width: globe,
                height: globe,
                borderRadius: globe / 2,
                shadowColor: "#4F8BFF",
                shadowOpacity: 0.45,
                shadowRadius: 28,
                shadowOffset: { width: 0, height: 0 },
                elevation: 0,
              }}
            >
              <OrbitingEarth disc style={{ width: globe, height: globe }} />
            </View>
          </View>
          <View style={{ justifyContent: "flex-end", padding: 24, gap: 14, paddingBottom: 30 }}>
            <FadeIn delay={150}>
              <Brand large light />
            </FadeIn>
            <FadeIn delay={300}>
              <Text style={{ ...type.body, color: "rgba(255,255,255,0.7)", textAlign: "center", marginBottom: 18 }}>
                Scan any rock. Find minerals near you.
              </Text>
            </FadeIn>
            <FadeIn delay={450}>
              <Button title="Get Started" onPress={() => void w.welcome()} />
            </FadeIn>
            <FadeIn delay={550}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sign In"
                onPress={() => setAuth(true)}
                style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ ...type.headline, color: "rgba(255,255,255,0.9)" }}>Sign In</Text>
              </Pressable>
            </FadeIn>
          </View>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <View
            style={{ flex: 1 }}
            {...hidden(stack.length > 0)}
          >
          <TabFade id={w.tab}>
            {w.tab === "Home" ? (
              <HomeScreen
                covered={stack.length > 0}
                analyze={(place) => analyze(place, "bottom")}
                guide={openGuide}
                identify={() => identify()}
                openRecent={(id) => {
                  w.openRecent(id);
                  push({ name: "analysis" });
                }}
              />
            ) : w.tab === "Explore" ? (
              <Explore analyze={(place) => analyze(place)} save={save} results={() => push({ name: "analysis" })} />
            ) : w.tab === "Scan" ? (
              <Scanner signIn={() => setAuth(true)} guide={openGuide} testIt={identify} />
            ) : w.tab === "Projects" ? (
              <ProjectsList
                projects={projects}
                busy={busy}
                error={error}
                signIn={() => setAuth(true)}
                create={save}
                guide={openGuide}
                remove={async (p) => {
                  setError("");
                  try {
                    await api(`/projects/${p.id}`, { method: "DELETE" });
                    setProjects((old) => old.filter((x) => x.id !== p.id));
                    haptic.success();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
                open={async (p) => {
                  setError("");
                  try {
                    setProject(await api<Project>(`/projects/${p.id}`));
                    push({ name: "project" });
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              />
            ) : (
              <Profile
                error={error}
                signIn={() => setAuth(true)}
                signOut={async () => {
                  try {
                    await signOut();
                    w.clearPrivateState();
                    setProject(null);
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              />
            )}
          </TabFade>
          <TabBar
            onDark={w.tab === "Home" || w.tab === "Explore" || w.tab === "Scan"}
            tab={w.tab}
            onChange={(t) => {
              w.setTab(t);
              setError("");
            }}
          />
          </View>
          {stack.map((r, i) => (
            <View
              key={`${i}-${r.name}`}
              style={StyleSheet.absoluteFill}
              pointerEvents={i === stack.length - 1 ? "auto" : "none"}
              {...hidden(i !== stack.length - 1)}
            >
              <StackScreen onBack={pop} from={r.name === "analysis" ? r.from : undefined}>
                {(back) => screen(r, back)}
              </StackScreen>
            </View>
          ))}
        </View>
      )}
      <Modal
        visible={auth || saving}
        animationType="slide"
        presentationStyle={Platform.OS === "ios" ? "pageSheet" : undefined}
        onRequestClose={() => {
          setAuth(false);
          setSaving(false);
        }}
      >
        <SafeAreaView style={ui.page}>
          <Header
            title={saving ? "Save to Projects" : register ? "Create Account" : "Welcome Back"}
            right={
              <Pressable
                accessibilityLabel="Close"
                hitSlop={10}
                onPress={() => {
                  setAuth(false);
                  setSaving(false);
                  setError("");
                }}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: c.fill,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={16} color={c.secondary} strokeWidth={2.6} />
              </Pressable>
            }
          />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[ui.content, { width: "100%", maxWidth: 430, alignSelf: "center", gap: 14 }]}
          >
            <FadeIn style={{ paddingVertical: 18 }}>
              <Brand large />
            </FadeIn>
            {saving ? (
              <>
                <TextInput
                  accessibilityLabel="Project name"
                  placeholder="Project name"
                  placeholderTextColor={c.tertiary}
                  value={name}
                  onChangeText={setName}
                  style={ui.field}
                />
                {w.hasPlace ? (
                  <Text style={[ui.small, { marginLeft: 4 }]}>{w.location.name}</Text>
                ) : (
                  <>
                    <PlaceSearch onSelect={w.selectLocation} />
                    <Button
                      plain
                      title="Use My Location"
                      onPress={() => void w.locateMe().catch((e) => setError((e as Error).message))}
                    />
                  </>
                )}
              </>
            ) : (
              <>
                <TextInput
                  accessibilityLabel="Email"
                  placeholder="Email"
                  placeholderTextColor={c.tertiary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  value={email}
                  onChangeText={setEmail}
                  style={ui.field}
                />
                <TextInput
                  accessibilityLabel="Password"
                  placeholder="Password (12+ characters)"
                  placeholderTextColor={c.tertiary}
                  secureTextEntry
                  autoCapitalize="none"
                  value={password}
                  onChangeText={setPassword}
                  style={ui.field}
                />
              </>
            )}
            {!!error && <Text style={ui.error}>{error}</Text>}
            <Button
              title={saving ? "Save Project" : register ? "Create Account" : "Sign In"}
              busy={busy}
              disabled={saving ? !name.trim() || !w.hasPlace : !email || !password}
              onPress={saving ? saveProject : login}
            />
            {!saving && (
              <Button
                plain
                title={register ? "Already have an account? Sign In" : "New here? Create Account"}
                onPress={() => {
                  setRegister(!register);
                  setError("");
                }}
              />
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <View style={styles.outer}>
        <WorkspaceProvider>
          <Shell />
        </WorkspaceProvider>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: "#0E1512", alignItems: "center" },
  frame: {
    flex: 1,
    width: "100%",
    maxWidth: Platform.OS === "web" ? 430 : undefined,
    overflow: "hidden",
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 30, backgroundColor: "#041713" },
  nav: {
    position: "absolute",
    bottom: 14,
    left: 16,
    right: 16,
    flexDirection: "row",
    padding: 6,
    borderRadius: 32,
    borderWidth: 0.5,
    overflow: "hidden",
    boxShadow: "0px 4px 14px rgba(0,0,0,0.10)",
  },
  navItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2, minHeight: 52 },
});
