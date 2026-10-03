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
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  BookOpen,
  Camera,
  Compass,
  Folder,
  Home,
  Map,
  UserRound,
  X,
} from "lucide-react-native";
import {
  Brand,
  Button,
  Empty,
  Header,
  MineralArt,
  Notice,
} from "./components/Primitives";
import PlaceSearch from "./components/PlaceSearch";
import { WorkspaceProvider, useWorkspace } from "./state/Workspace";
import { api, authenticate, coordinates, post, signOut } from "./services/api";
import { colors, ui } from "./theme";
import type { Project } from "./types";
import { Scanner } from "./screens";
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
  const analyze = () => {
    setRoute("analysis");
    void w.analyze();
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
        <>
          <Header title={project.name} back={back} />
          <ScrollView contentContainerStyle={ui.content}>
            <View style={ui.card}>
              <Text style={ui.h2}>{project.location.name}</Text>
              <Text style={ui.body}>{coordinates(project.location)}</Text>
              <Text style={ui.small}>
                Private project • {project.records?.length || 0} field records
              </Text>
            </View>
            <Button
              title="Explore this location"
              onPress={() => {
                w.selectLocation(project.location);
                back();
                w.setTab("Explore");
              }}
            />
            <Text style={ui.h2}>Field records</Text>
            {project.records?.map((r) => (
              <View style={ui.card} key={r.id}>
                <Text style={ui.h3}>{r.title}</Text>
                {!!r.photos?.length && (
                  <ScrollView horizontal>
                    {r.photos.map((photo, i) => (
                      <Image
                        key={i}
                        accessibilityLabel={`Sample photo ${i + 1}`}
                        source={{ uri: photo }}
                        style={{
                          width: 160,
                          height: 160,
                          borderRadius: 16,
                          marginRight: 8,
                        }}
                      />
                    ))}
                  </ScrollView>
                )}
                {!!r.rock_type && r.rock_type !== "Unidentified" && (
                  <Button
                    outline
                    title={`About ${r.rock_type}`}
                    onPress={() => openGuide(r.rock_type!)}
                  />
                )}
                <Text style={ui.body}>{r.description}</Text>
                <Text style={ui.small}>
                  {r.kind} • {coordinates(r.location)}
                </Text>
              </View>
            ))}
            {!project.records?.length && (
              <Empty title="No samples yet" description="" />
            )}
          </ScrollView>
        </>
      ) : w.tab === "Home" ? (
        <HomeScreen analyze={analyze} guide={openGuide} />
      ) : w.tab === "Explore" ? (
        <Explore
          analyze={analyze}
          save={save}
          results={() => setRoute("analysis")}
        />
      ) : w.tab === "Scan" ? (
        <Scanner signIn={() => setAuth(true)} />
      ) : w.tab === "Projects" ? (
        <>
          <Header
            title="My Projects"
            right={
              <Pressable accessibilityLabel="Create project" onPress={save}>
                <Text style={{ fontSize: 28, color: colors.green }}>+</Text>
              </Pressable>
            }
          />
          <ScrollView contentContainerStyle={ui.content}>
            <View style={styles.segment}>
              <Text style={{ color: colors.green, fontWeight: "600" }}>
                My workspace
              </Text>
              <Text style={ui.small}>Private</Text>
            </View>
            {!!error && <Text style={ui.error}>{error}</Text>}
            {busy && <ActivityIndicator color={colors.green} />}
            {!w.user ? (
              <Empty title="Your projects" description="Sign in to sync.">
                <Button title="Sign In" onPress={() => setAuth(true)} />
              </Empty>
            ) : !projects.length ? (
              <Empty title="No projects yet" description="">
                <Button title="Create Project" onPress={save} />
              </Empty>
            ) : (
              projects.map((p) => (
                <Pressable
                  key={p.id}
                  style={[ui.card, ui.row]}
                  onPress={async () => {
                    setError("");
                    try {
                      setProject(await api<Project>(`/projects/${p.id}`));
                      setRoute("project");
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  <View style={styles.projectArt}>
                    <Map size={38} color="#B4CA98" />
                  </View>
                  <View style={{ flex: 1, gap: 8 }}>
                    <Text style={ui.h3}>{p.name}</Text>
                    <Text style={ui.small}>{p.location.name}</Text>
                    <Text style={{ fontSize: 11, color: colors.green }}>→</Text>
                  </View>
                </Pressable>
              ))
            )}
          </ScrollView>
        </>
      ) : (
        <>
          <Header title="Profile" />
          <ScrollView contentContainerStyle={ui.content}>
            <View style={[ui.card, { alignItems: "center", padding: 28 }]}>
              <View style={styles.avatar}>
                <UserRound color={colors.green} />
              </View>
              <Text style={ui.h2}>{w.user ? "Account" : "Guest"}</Text>
              <Text style={ui.body}>{w.user?.email || ""}</Text>
              {!w.user && (
                <Button
                  title="Sign In / Create Account"
                  onPress={() => setAuth(true)}
                />
              )}
            </View>
            <View style={[ui.card, ui.between]}>
              <View>
                <Text style={ui.h3}>Professional detail</Text>
                <Text style={ui.small}>Sources and evidence IDs</Text>
              </View>
              <Switch
                accessibilityLabel="Professional detail"
                value={w.professional}
                onValueChange={w.setProfessional}
                trackColor={{ true: colors.green }}
              />
            </View>
            <View style={ui.card}>
              <Brand />

              <Text style={ui.small}>
                Live coverage varies by region. This tool does not establish
                reserves, grade, land access or legal rights.
              </Text>
              <Text style={ui.small}>
                Earth image: NASA / JPL. Mineral illustrations are illustrative.
              </Text>
            </View>
            {!!error && <Text style={ui.error}>{error}</Text>}
            {w.user && (
              <Button
                outline
                title="Sign Out"
                onPress={async () => {
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
          </ScrollView>
        </>
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
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.pale,
    alignItems: "center",
    justifyContent: "center",
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    gap: 13,
    minHeight: 104,
  },
  tileLabel: { fontSize: 12, fontWeight: "600", color: colors.ink },
  mineral: {
    flex: 1,
    alignItems: "center",
    gap: 8,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: "#fff",
  },
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
  segment: {
    backgroundColor: "#EDF1ED",
    borderRadius: 12,
    padding: 15,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  projectArt: {
    backgroundColor: "#315840",
    width: 78,
    height: 98,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
});
