import MineralGuide from "./MineralGuide";
import HomeScreen from "./HomeScreen";
import { BlurView } from "expo-blur";
import { useState, useEffect } from "react";
import {
  ActivityIndicator,
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
import { LinearGradient } from "expo-linear-gradient";
import { Camera, Compass, Folder, Home, UserRound, X } from "lucide-react-native";
import { Brand, Button, Header } from "./components/Primitives";
import { WorkspaceProvider, useWorkspace } from "./state/Workspace";
import { api, authenticate, post, signOut } from "./services/api";
import { colors, ui } from "./theme";
import type { Location, Project } from "./types";
import { Profile, ProjectDetail, ProjectsList } from "./ProjectScreens";
import { Scanner } from "./ScanScreen";
import { AnalysisScreen, Explore, ReportScreen } from "./ExploreScreens";
function Shell() {
  const w = useWorkspace();
  const [guideQuery, setGuideQuery] = useState("");
  const [guideOrigin, setGuideOrigin] = useState("");
  function openGuide(query = "") {
    setGuideQuery(query);
    setGuideOrigin(route);
    setRoute("guide");
  }
  const [route, setRoute] = useState(""),
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
  const back = () => {
    setRoute("");
    setError("");
  };
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (route) {
        back();
        return true;
      }
      if (w.tab !== "Home") {
        w.setTab("Home");
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [route, w.tab]);
  useEffect(() => {
    if (w.user && w.tab === "Projects") {
      setBusy(true);
      api<Project[]>("/projects")
        .then(setProjects)
        .catch((e) => setError(e.message))
        .finally(() => setBusy(false));
    } else if (!w.user) setProjects([]);
  }, [w.user, w.tab, saving]);
  const analyze = (point?: Location) => {
    if (point) w.selectLocation(point);
    setRoute("analysis");
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
      w.setUser(
        await authenticate(register ? "register" : "login", email, password),
      );
      setAuth(false);
      setPassword("");
      void w.welcome();
    } catch (e) {
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
      back();
      w.setTab("Projects");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const dark =
    !w.welcomed || (!route && (w.tab === "Explore" || w.tab === "Scan"));
  return (
    <SafeAreaView
      style={[styles.frame, dark && { backgroundColor: colors.dark }]}
    >
      <StatusBar barStyle={dark ? "light-content" : "dark-content"} />
      {!w.ready ? (
        <View style={styles.center}>
          <Brand large light />
          <ActivityIndicator color="#DAB557" />
        </View>
      ) : !w.welcomed ? (
        <View style={{ flex: 1, backgroundColor: "#031310" }}>
          <Image
            source={require("../assets/earth.jpg")}
            style={{
              position: "absolute",
              top: 0,
              width: "100%",
              height: "65%",
            }}
            resizeMode="cover"
          />
          <LinearGradient
            colors={["transparent", "#041713", "#041713"]}
            locations={[0, 0.68, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={{
              flex: 1,
              justifyContent: "flex-end",
              padding: 30,
              gap: 25,
              paddingBottom: 35,
            }}
          >
            <Brand large light />

            <Button title="Get Started" onPress={() => void w.welcome()} />
            <Pressable accessibilityRole="button" onPress={() => setAuth(true)}>
              <Text style={{ color: "#fff", textAlign: "center", padding: 10 }}>
                Sign In
              </Text>
            </Pressable>
          </View>
        </View>
      ) : route === "analysis" ? (
        <AnalysisScreen
          back={back}
          save={save}
          report={() => setRoute("report")}
          guide={openGuide}
        />
      ) : route === "report" ? (
        <ReportScreen back={() => setRoute("analysis")} />
      ) : route === "guide" ? (
        <MineralGuide
          initialQuery={guideQuery}
          back={() => setRoute(guideOrigin)}
          signIn={() => setAuth(true)}
          explore={() => {
            setRoute("");
            w.setTab("Explore");
          }}
        />
      ) : route === "project" && project ? (
        <ProjectDetail
          project={project}
          setProject={setProject}
          back={back}
          guide={openGuide}
          analyze={() => analyze(project.location)}
          deleted={() => {
            setProjects((old) => old.filter((p) => p.id !== project.id));
            setProject(null);
            back();
          }}
        />
      ) : w.tab === "Home" ? (
        <HomeScreen
          analyze={() => analyze()}
          guide={openGuide}
          openRecent={(id) => {
            w.openRecent(id);
            setRoute("analysis");
          }}
        />
      ) : w.tab === "Explore" ? (
        <Explore
          analyze={() => analyze()}
          save={save}
          results={() => setRoute("analysis")}
        />
      ) : w.tab === "Scan" ? (
        <Scanner signIn={() => setAuth(true)} guide={openGuide} />
      ) : w.tab === "Projects" ? (
        <ProjectsList
          projects={projects}
          busy={busy}
          error={error}
          signIn={() => setAuth(true)}
          create={save}
          open={async (p) => {
            setError("");
            try {
              setProject(await api<Project>(`/projects/${p.id}`));
              setRoute("project");
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
      {w.welcomed && !route && (
        <View style={styles.nav}>
          <BlurView
            intensity={65}
            tint="light"
            style={StyleSheet.absoluteFill}
          />
          {(
            [
              ["Home", Home],
              ["Explore", Compass],
              ["Scan", Camera],
              ["Projects", Folder],
              ["Profile", UserRound],
            ] as const
          ).map(([tab, Icon]) => (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: w.tab === tab }}
              accessibilityLabel={tab}
              key={tab}
              onPress={() => {
                w.setTab(tab);
                setError("");
              }}
              style={[
                styles.navItem,
                w.tab === tab && {
                  backgroundColor: "#DDE8D4",
                  borderRadius: 28,
                },
              ]}
            >
              <Icon
                size={21}
                color={w.tab === tab ? colors.green : "#7C8494"}
                strokeWidth={w.tab === tab ? 2.4 : 1.6}
              />
              <Text
                style={{
                  fontSize: 10,
                  color: w.tab === tab ? colors.green : "#747D8C",
                  fontWeight: w.tab === tab ? "700" : "400",
                }}
              >
                {tab}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      <Modal
        visible={auth || saving}
        animationType="slide"
        onRequestClose={() => {
          setAuth(false);
          setSaving(false);
        }}
      >
        <SafeAreaView style={ui.page}>
          <Header
            title={
              saving
                ? "Save to My Projects"
                : register
                  ? "Create Account"
                  : "Welcome Back"
            }
            right={
              <Pressable
                accessibilityLabel="Close"
                onPress={() => {
                  setAuth(false);
                  setSaving(false);
                  setError("");
                }}
              >
                <X size={22} />
              </Pressable>
            }
          />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              ui.content,
              { width: "100%", maxWidth: 430, alignSelf: "center" },
            ]}
          >
            <Brand large />

            {saving ? (
              <>
                <Text style={ui.label}>Project name</Text>
                <TextInput
                  accessibilityLabel="Project name"
                  value={name}
                  onChangeText={setName}
                  style={ui.field}
                />
                <Text style={ui.body}>{w.location.name}</Text>
              </>
            ) : (
              <>
                <TextInput
                  accessibilityLabel="Email"
                  placeholder="Email address"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  value={email}
                  onChangeText={setEmail}
                  style={ui.field}
                />
                <TextInput
                  accessibilityLabel="Password"
                  placeholder="Password (at least 12 characters)"
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
              title={
                saving
                  ? "Save Project"
                  : register
                    ? "Create Account"
                    : "Sign In"
              }
              busy={busy}
              disabled={saving ? !name.trim() : !email || !password}
              onPress={saving ? saveProject : login}
            />
            {!saving && (
              <Button
                outline
                title={
                  register
                    ? "Already have an account? Sign In"
                    : "New here? Create Account"
                }
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
  outer: { flex: 1, backgroundColor: "#D5DDD5", alignItems: "center" },
  frame: {
    flex: 1,
    width: "100%",
    maxWidth: Platform.OS === "web" ? 430 : undefined,
    backgroundColor: colors.bg,
    overflow: "hidden",
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 30 },
  nav: {
    position: "absolute",
    bottom: 12,
    left: 15,
    right: 15,
    flexDirection: "row",
    padding: 6,
    backgroundColor: "#F7FAF1CC",
    borderRadius: 36,
    borderWidth: 1,
    borderColor: "#FFFFFFCC",
    overflow: "hidden",
    boxShadow: "0px 5px 25px rgba(24,45,27,0.16)",
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minHeight: 54,
  },
});
