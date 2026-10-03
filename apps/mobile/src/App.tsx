import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { Camera, Compass, Folder, Home, UserRound, X } from "lucide-react-native";
import { Brand, Button, Header } from "./components/Primitives";
import { AnalysisScreen, Explore, ReportScreen } from "./ExploreScreens";
import HomeScreen from "./HomeScreen";
import IdentifyScreen from "./IdentifyScreen";
import MineralGuide from "./MineralGuide";
import { FadeIn, haptic, StackScreen, TabFade } from "./motion";
import { Profile, ProjectDetail, ProjectsList } from "./ProjectScreens";
import { Scanner } from "./ScanScreen";
import { api, authenticate, post, signOut } from "./services/api";
import { WorkspaceProvider, useWorkspace } from "./state/Workspace";
import { type, useTheme } from "./theme";
import type { Location, Project, Tab } from "./types";

const native = Platform.OS !== "web";
type Route =
  | { name: "analysis" }
  | { name: "report" }
  | { name: "guide"; query: string }
  | { name: "project" }
  | { name: "identify"; suggested: string[] };
const TABS = [
  ["Home", Home],
  ["Explore", Compass],
  ["Scan", Camera],
  ["Projects", Folder],
  ["Profile", UserRound],
] as const;

/** Floating glass tab bar with a lens that slides to the selected tab. */
function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const { c, dark } = useTheme();
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
      <BlurView intensity={70} tint={dark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
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
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={name}
            key={name}
            onPress={() => {
              if (!on) haptic.select();
              onChange(name);
            }}
            style={styles.navItem}
          >
            <Icon size={22} color={on ? c.tint : c.label} strokeWidth={on ? 2.4 : 1.8} />
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
      api<Project[]>("/projects")
        .then(setProjects)
        .catch((e) => setError(e.message))
        .finally(() => setBusy(false));
    } else if (!w.user) setProjects([]);
  }, [w.user, w.tab, saving, stack.length]);
  const analyze = (point?: Location) => {
    if (point) w.selectLocation(point);
    if (top?.name !== "analysis") push({ name: "analysis" });
    void w.analyze(point);
  };
  const save = () => {
    if (!w.user) {
      setAuth(true);
      return;
    }
    setName(w.location.name.split(",")[0] + " exploration");
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
  const overDark = !w.welcomed || (!stack.length && (w.tab === "Explore" || w.tab === "Scan"));
  const screen = (r: Route, back: () => void) => {
    switch (r.name) {
      case "analysis":
        return (
          <AnalysisScreen
            back={back}
            save={save}
            report={() => push({ name: "report" })}
            guide={openGuide}
          />
        );
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
    <SafeAreaView style={[styles.frame, { backgroundColor: overDark ? "#000" : c.bg }]}>
      <StatusBar barStyle={overDark || dark ? "light-content" : "dark-content"} />
      {!w.ready ? (
        <View style={styles.center}>
          <Brand large light />
          <ActivityIndicator color="#DAB557" />
        </View>
      ) : !w.welcomed ? (
        <View style={{ flex: 1, backgroundColor: "#031310" }}>
          <Image
            source={require("../assets/earth.jpg")}
            style={{ position: "absolute", top: 0, width: "100%", height: "68%" }}
            resizeMode="cover"
          />
          <LinearGradient
            colors={["transparent", "#041713", "#041713"]}
            locations={[0, 0.66, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={{ flex: 1, justifyContent: "flex-end", padding: 24, gap: 14, paddingBottom: 30 }}>
            <FadeIn delay={150}>
              <Brand large light />
            </FadeIn>
            <FadeIn delay={300}>
              <Text style={{ ...type.body, color: "rgba(255,255,255,0.7)", textAlign: "center", marginBottom: 18 }}>
                Identify rocks. Read the ground.
              </Text>
            </FadeIn>
            <FadeIn delay={450}>
              <Button title="Get Started" onPress={() => void w.welcome()} />
            </FadeIn>
            <FadeIn delay={550}>
              <Button plain title="Sign In" onPress={() => setAuth(true)} style={{ minHeight: 44 }} />
            </FadeIn>
          </View>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <View
            style={{ flex: 1 }}
            aria-hidden={stack.length > 0}
            accessibilityElementsHidden={stack.length > 0}
            importantForAccessibility={stack.length ? "no-hide-descendants" : "auto"}
          >
          <TabFade id={w.tab}>
            {w.tab === "Home" ? (
              <HomeScreen
                analyze={() => analyze()}
                guide={openGuide}
                identify={() => identify()}
                openRecent={(id) => {
                  w.openRecent(id);
                  push({ name: "analysis" });
                }}
              />
            ) : w.tab === "Explore" ? (
              <Explore analyze={() => analyze()} save={save} results={() => push({ name: "analysis" })} />
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
              aria-hidden={i !== stack.length - 1}
              accessibilityElementsHidden={i !== stack.length - 1}
              importantForAccessibility={i === stack.length - 1 ? "auto" : "no-hide-descendants"}
            >
              <StackScreen onBack={pop}>{(back) => screen(r, back)}</StackScreen>
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
                <Text style={[ui.small, { marginLeft: 4 }]}>{w.location.name}</Text>
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
              disabled={saving ? !name.trim() : !email || !password}
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
    boxShadow: "0px 10px 30px rgba(0,0,0,0.18)",
  },
  navItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2, minHeight: 52 },
});
