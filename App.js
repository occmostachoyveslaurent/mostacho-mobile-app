import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Modal, Platform,
  Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet,
  Text, TextInput, View
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { API_BASE_URL } from "./api/config";

// --- API HELPERS ---
const apiUrl = (path) => `${API_BASE_URL.replace(/\/$/, "")}/${path}`;

async function apiRequest(path, options = {}) {
  const response = await fetch(apiUrl(path), options);
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : {}; }
  catch { throw new Error("The server returned an invalid response. Check your PHP API and XAMPP logs."); }
  if (!response.ok || data.success === false) {
    throw new Error(data.message || `Request failed (${response.status}).`);
  }
  return data;
}

const DEFAULT_AVATAR = "https://i.pravatar.cc/150?img=12";

const stories = [
  { name: "Your story", avatar: DEFAULT_AVATAR, own: true },
  { name: "sophia.lee", avatar: "https://i.pravatar.cc/150?img=47" },
  { name: "james.visuals", avatar: "https://i.pravatar.cc/150?img=11" },
  { name: "mika.santos", avatar: "https://i.pravatar.cc/150?img=44" },
  { name: "noah.jpg", avatar: "https://i.pravatar.cc/150?img=13" },
  { name: "ella.grace", avatar: "https://i.pravatar.cc/150?img=49" }
];

function Avatar({ uri, size = 40, ring = false }) {
  return <View style={[styles.avatarWrap, ring && styles.storyRing, { width: size + (ring ? 5 : 0), height: size + (ring ? 5 : 0) }]}>
    <Image source={{ uri: uri || DEFAULT_AVATAR }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  </View>;
}

function IconButton({ name, size = 23, color = "#F5F5F7", onPress, style }) {
  return <Pressable onPress={onPress} hitSlop={10} style={[styles.iconButton, style]}>
    <Ionicons name={name} size={size} color={color} />
  </Pressable>;
}

export default function App() {
  const [posts, setPosts] = useState([]);
  const [tab, setTab] = useState("Home");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [search, setSearch] = useState("");
  
  const [modal, setModal] = useState(""); 
  const [editing, setEditing] = useState(null);
  const [selectedPost, setSelectedPost] = useState(null); 
  
  const [draftCaption, setDraftCaption] = useState("");
  const [draftImage, setDraftImage] = useState(null);
  
  const [commentPost, setCommentPost] = useState(null);
  const [commentText, setCommentText] = useState("");
  
  const [profile, setProfile] = useState({
    name: "yves.mostacho",
    fullName: "Yves Laurent Mostacho",
    avatar: DEFAULT_AVATAR,
    bio: "Creating moments, one frame at a time. 📸\nLife looks better in color."
  });
  const [draftProfile, setDraftProfile] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const savedProfile = await AsyncStorage.getItem("@vybe/profile");
        if (savedProfile) setProfile(JSON.parse(savedProfile));
      } catch (e) { console.warn("Could not load profile", e); }
    })();
  }, []);

  const loadPosts = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const data = await apiRequest(`posts.php?user=${encodeURIComponent(profile.name)}`);
      setPosts(Array.isArray(data.posts) ? data.posts : []);
      setConnectionError("");
      return data.posts || [];
    } catch (error) {
      setConnectionError(error.message || "Could not connect to the database.");
      return null;
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => { loadPosts(); }, [profile.name]);

  const myPosts = useMemo(() => posts.filter(p => p.user === profile.name), [posts, profile.name]);
  const filteredPosts = useMemo(() => posts.filter(p =>
    p.user.toLowerCase().includes(search.toLowerCase()) ||
    p.caption.toLowerCase().includes(search.toLowerCase())
  ), [posts, search]);

  const pickImage = async (isProfile = false) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow photo library access to choose a picture.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], allowsEditing: true, aspect: isProfile ? [1, 1] : [4, 5], quality: 0.85
    });
    
    if (!result.canceled && result.assets?.[0]?.uri) {
      const asset = result.assets[0];
      const imageData = Platform.OS === "web" && asset.file 
        ? { uri: asset.uri, file: asset.file } 
        : asset.uri;

      if (isProfile) {
        setDraftProfile(prev => ({ ...prev, avatar: imageData }));
      } else {
        setDraftImage(imageData);
      }
    }
  };

  const openOptions = (post) => {
    setSelectedPost(post);
    setModal("options");
  };

  const openCreate = (post = null) => {
    setEditing(post);
    setDraftCaption(post?.caption || "");
    setDraftImage(post?.image || null);
    setModal("editor");
  };

  const savePost = async () => {
    if (!draftImage) return Alert.alert("Add a photo", "Choose a photo before publishing.");
    if (saving) return;

    setSaving(true);
    try {
      const form = new FormData();
      form.append("user", profile.name);
      form.append("avatar", profile.avatar);
      form.append("location", editing?.location || "Your location");
      form.append("caption", draftCaption.trim());
      if (editing) form.append("id", String(editing.id));

      const currentImage = typeof draftImage === "string" ? draftImage : draftImage.uri;
      const originalImage = editing ? editing.image : null;
      const imageChanged = !editing || currentImage !== originalImage;

      if (imageChanged) {
        if (/^https?:\/\//i.test(currentImage)) {
          form.append("image_url", currentImage);
        } else if (Platform.OS === "web") {
          if (draftImage && draftImage.file) {
            form.append("image", draftImage.file, `vybe-${Date.now()}.jpg`);
          } else {
            const blobRes = await fetch(currentImage);
            const blob = await blobRes.blob();
            form.append("image", blob, `vybe-${Date.now()}.jpg`);
          }
        } else {
          form.append("image", { uri: currentImage, name: `vybe-${Date.now()}.jpg`, type: "image/jpeg" });
        }
      }

      await apiRequest("posts.php", { method: "POST", body: form });
      await loadPosts(false);
      setModal("");
      setEditing(null);
      setTab("Home");
      Alert.alert("Success", editing ? "Your post has been updated." : "Your post has been published.");
    } catch (error) {
      Alert.alert("Could not save post", error.message);
    } finally {
      setSaving(false);
    }
  };

  // --- FIXED: SENDING JSON FOR DELETE ---
  const deletePost = (post) => {
    Alert.alert("Delete post?", "This post will be permanently removed.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          await apiRequest("posts.php", { 
            method: "POST", 
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "delete", id: post.id, user: profile.name })
          });
          
          setPosts(prev => prev.filter(p => String(p.id) !== String(post.id)));
          setModal(""); 
          Alert.alert("Deleted", "The post has been deleted.");
        } catch (error) {
          Alert.alert("Could not delete post", error.message);
        }
      }}
    ]);
  };

  const toggleLike = async (id) => {
    try {
      const data = await apiRequest("likes.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: id, user: profile.name })
      });
      setPosts(prev => prev.map(p => String(p.id) === String(id) ? { ...p, liked: data.liked, likes: data.likes } : p));
    } catch (error) {
      Alert.alert("Like failed", error.message);
    }
  };

  const submitComment = async () => {
    if (!commentText.trim() || !commentPost) return;
    try {
      const data = await apiRequest("comments.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: commentPost.id, user: profile.name, text: commentText.trim() })
      });
      const newComment = data.comment;
      setPosts(prev => prev.map(p => String(p.id) === String(commentPost.id) ? { ...p, comments: [...p.comments, newComment] } : p));
      setCommentPost(prev => prev ? { ...prev, comments: [...prev.comments, newComment] } : prev);
      setCommentText("");
    } catch (error) {
      Alert.alert("Comment failed", error.message);
    }
  };

  const openEditProfile = () => {
    setDraftProfile(profile);
    setModal("profile");
  };

  const saveProfile = async () => {
    try {
      await AsyncStorage.setItem("@vybe/profile", JSON.stringify(draftProfile));
      setProfile(draftProfile);
      setModal("");
      Alert.alert("Success", "Profile updated locally.");
    } catch (error) {
      Alert.alert("Error", "Could not save profile.");
    }
  };

  const renderPost = ({ item }) => (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <View style={styles.userLine}>
          <Avatar uri={item.avatar} size={39} />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={styles.username}>{item.user}</Text>
            <Text style={styles.location}>{item.location || " "}</Text>
          </View>
        </View>
        {item.user === profile.name
          ? <IconButton name="ellipsis-horizontal" onPress={() => openOptions(item)} />
          : <IconButton name="ellipsis-horizontal" onPress={() => Alert.alert("More options", "You are viewing a community post.")} />}
      </View>
      <Image source={{ uri: item.image }} style={styles.postImage} resizeMode="cover" />
      <View style={styles.postActions}>
        <View style={styles.actionGroup}>
          <IconButton name={item.liked ? "heart" : "heart-outline"} color={item.liked ? "#FF5576" : "#F5F5F7"} size={25} onPress={() => toggleLike(item.id)} />
          <IconButton name="chatbubble-outline" onPress={() => { setCommentPost(item); setModal("comments"); }} />
          <IconButton name="paper-plane-outline" onPress={() => Alert.alert("Share", "Sharing will be available later.")} />
        </View>
        <IconButton name="bookmark-outline" onPress={() => Alert.alert("Saved", "Bookmark feature is coming soon.")} />
      </View>
      <Text style={styles.likes}>{item.likes.toLocaleString()} likes</Text>
      {!!item.caption && <Text style={styles.caption}><Text style={styles.username}>{item.user} </Text>{item.caption}</Text>}
      {(item.comments || []).length > 0 && <Pressable onPress={() => { setCommentPost(item); setModal("comments"); }}><Text style={styles.viewComments}>View all {item.comments.length} comments</Text></Pressable>}
      <Text style={styles.time}>{item.time} ago</Text>
    </View>
  );

  const Header = () => <View style={styles.header}>
    <Text style={styles.logo}>vybe<Text style={styles.logoDot}>.</Text></Text>
    <View style={styles.headerActions}>
      <IconButton name="add-circle-outline" size={25} onPress={() => openCreate()} />
      <IconButton name="paper-plane-outline" size={24} onPress={() => Alert.alert("Messages", "Direct messaging is coming soon.")} />
    </View>
  </View>;

  const Stories = () => <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stories}>
    {stories.map((s, i) => <Pressable key={s.name} style={styles.story} onPress={() => Alert.alert(s.name, s.own ? "Add a story from the + button." : "Stories are preview-only in this demo.")}>
      <View style={styles.storyImageWrap}>
        <Avatar uri={s.own ? profile.avatar : s.avatar} size={58} ring={!s.own} />
        {s.own && <View style={styles.addStory}><Ionicons name="add" size={13} color="#FFF" /></View>}
      </View>
      <Text numberOfLines={1} style={styles.storyName}>{s.own ? "Your story" : s.name}</Text>
    </Pressable>)}
  </ScrollView>;

  const Profile = () => <ScrollView showsVerticalScrollIndicator={false}>
    <View style={styles.profileTop}>
      <Avatar uri={profile.avatar} size={82} />
      <View style={styles.statsRow}>
        <Stat value={myPosts.length} label="Posts" />
        <Stat value="2.4k" label="Followers" />
        <Stat value="816" label="Following" />
      </View>
    </View>
    <Text style={styles.profileName}>{profile.fullName}</Text>
    <Text style={styles.bio}>{profile.bio}</Text>
    <View style={styles.profileButtons}>
      <Pressable style={styles.primaryButton} onPress={openEditProfile}><Text style={styles.primaryButtonText}>Edit profile</Text></Pressable>
      <Pressable style={styles.secondaryButton} onPress={() => Alert.alert("Share profile", "Profile sharing is coming soon.")}><Text style={styles.secondaryButtonText}>Share profile</Text></Pressable>
    </View>
    <View style={styles.gridHeader}><Ionicons name="grid" color="#F5F5F7" size={19} /><Text style={styles.gridLabel}>YOUR POSTS</Text></View>
    <View style={styles.photoGrid}>
      {myPosts.map(p => <Pressable key={String(p.id)} style={styles.gridItem} onPress={() => openOptions(p)}>
        <Image source={{ uri: p.image }} style={styles.gridImage} />
      </Pressable>)}
      {myPosts.length === 0 && <View style={styles.emptyState}><Ionicons name="images-outline" size={34} color="#777" /><Text style={styles.emptyTitle}>Share your first moment</Text><Text style={styles.emptyText}>Your posts will appear here.</Text><Pressable style={styles.primaryButton} onPress={() => openCreate()}><Text style={styles.primaryButtonText}>Create post</Text></Pressable></View>}
    </View>
  </ScrollView>;

  const Explore = () => <View style={{ flex: 1 }}>
    <View style={styles.searchBox}><Ionicons name="search" size={19} color="#8D8D98" /><TextInput value={search} onChangeText={setSearch} placeholder="Search people or captions" placeholderTextColor="#777" style={styles.searchInput} /></View>
    <FlatList data={filteredPosts} keyExtractor={p => String(p.id)} numColumns={2} contentContainerStyle={styles.exploreGrid} renderItem={({ item }) => <Pressable style={styles.exploreItem} onPress={() => Alert.alert(item.user, item.caption)}><Image source={{ uri: item.image }} style={styles.exploreImage} /><View style={styles.exploreOverlay}><Ionicons name="heart" color="#FFF" size={14} /><Text style={styles.exploreLikes}>{item.likes}</Text></View></Pressable>} ListEmptyComponent={<Text style={styles.emptyText}>No posts found.</Text>} />
  </View>;

  const Activity = () => <View style={styles.activityWrap}>
    <Text style={styles.sectionTitle}>Activity</Text>
    <Text style={styles.sectionSubtitle}>Your latest interactions</Text>
    {[{ icon: "heart", color: "#FF5576", title: "Your feed is looking good", sub: "Like posts you love to see more of them.", time: "Today" }, { icon: "people", color: "#9B8CFF", title: "Find your people", sub: "Explore creators and discover new inspiration.", time: "Today" }, { icon: "sparkles", color: "#F4BD62", title: "Welcome to VYBE", sub: "Your space to share the moments that matter.", time: "Just now" }].map((n, i) => <View key={i} style={styles.activityRow}><View style={[styles.activityIcon, { backgroundColor: `${n.color}20` }]}><Ionicons name={n.icon} size={20} color={n.color} /></View><View style={{ flex: 1 }}><Text style={styles.activityTitle}>{n.title}</Text><Text style={styles.activitySub}>{n.sub}</Text></View><Text style={styles.activityTime}>{n.time}</Text></View>)}
  </View>;

  const Stat = ({ value, label }) => <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0B0F" />
      <Header />
      {tab === "Home" && <FlatList data={posts} keyExtractor={p => String(p.id)} renderItem={renderPost} ListHeaderComponent={<Stories />} contentContainerStyle={{ paddingBottom: 100, flexGrow: 1 }} showsVerticalScrollIndicator={false} ListEmptyComponent={
        <View style={styles.emptyState}>
          {loading ? <ActivityIndicator color="#A78BFA" size="large" /> : <Ionicons name={connectionError ? "cloud-offline-outline" : "images-outline"} size={34} color="#777" />}
          <Text style={styles.emptyTitle}>{loading ? "Connecting to database..." : connectionError ? "Database unavailable" : "No posts yet"}</Text>
          <Text style={styles.emptyText}>{loading ? "Loading posts from your database." : connectionError || "Create the first post and it will be saved to MySQL."}</Text>
          {!loading && connectionError ? <Pressable style={styles.primaryButton} onPress={() => loadPosts()}><Text style={styles.primaryButtonText}>Retry connection</Text></Pressable> : null}
          {!loading && !connectionError ? <Pressable style={styles.primaryButton} onPress={() => openCreate()}><Text style={styles.primaryButtonText}>Create post</Text></Pressable> : null}
        </View>
      } />}
      {tab === "Explore" && <Explore />}
      {tab === "Activity" && <Activity />}
      {tab === "Profile" && <Profile />}
      <View style={styles.tabBar}>
        {[["Home", "home", "home-outline"], ["Explore", "compass", "compass-outline"], ["Create", "add-circle", "add-circle-outline"], ["Activity", "heart", "heart-outline"], ["Profile", "person", "person-outline"]].map(([label, active, inactive]) => <Pressable key={label} style={styles.tabItem} onPress={() => label === "Create" ? openCreate() : setTab(label)}>
          <Ionicons name={tab === label ? active : inactive} size={24} color={tab === label ? "#A78BFA" : "#8B8B96"} />
          <Text style={[styles.tabText, tab === label && styles.tabTextActive]}>{label}</Text>
        </Pressable>)}
      </View>

      {/* --- POST OPTIONS MENU (3 DOTS) --- */}
      <Modal visible={modal === "options"} animationType="fade" transparent onRequestClose={() => setModal("")}>
        <Pressable style={styles.commentBackdrop} onPress={() => setModal("")}>
          <View style={[styles.commentSheet, { backgroundColor: '#1C1C24' }]}>
            <View style={styles.sheetHandle} />
            <Text style={[styles.modalTitle, { marginBottom: 15, textAlign: 'center' }]}>Post Options</Text>
            
            <Pressable style={styles.optionRow} onPress={() => { setModal(""); setTimeout(() => openCreate(selectedPost), 100); }}>
              <Ionicons name="create-outline" size={22} color="#FFF" />
              <Text style={styles.optionText}>Edit Post</Text>
            </Pressable>

            <Pressable style={styles.optionRow} onPress={() => { setModal(""); setTimeout(() => deletePost(selectedPost), 100); }}>
              <Ionicons name="trash-outline" size={22} color="#FF5576" />
              <Text style={[styles.optionText, { color: "#FF5576" }]}>Delete Post</Text>
            </Pressable>

            <Pressable style={[styles.optionRow, { borderTopWidth: 1, borderTopColor: "#30303A", marginTop: 10, paddingTop: 15 }]} onPress={() => setModal("")}>
              <Text style={[styles.optionText, { textAlign: 'center', width: '100%', color: '#9999A4' }]}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* --- POST EDITOR MODAL --- */}
      <Modal visible={modal === "editor"} animationType="slide" onRequestClose={() => setModal("")}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <IconButton name="close" onPress={() => setModal("")} />
            <Text style={styles.modalTitle}>{editing ? "Edit post" : "New post"}</Text>
            <Pressable onPress={savePost} disabled={saving}><Text style={[styles.shareText, saving && { opacity: 0.5 }]}>{saving ? "Saving..." : editing ? "Save" : "Share"}</Text></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.editorContent}>
            <Pressable style={styles.imagePicker} onPress={() => pickImage(false)}>
              {draftImage ? (
                <Image source={{ uri: typeof draftImage === "string" ? draftImage : draftImage.uri }} style={styles.previewImage} />
              ) : (
                <View style={styles.imagePlaceholder}><Ionicons name="images-outline" size={38} color="#A78BFA" /><Text style={styles.imagePlaceholderTitle}>Choose a photo</Text><Text style={styles.imagePlaceholderSub}>Tap to browse your gallery</Text></View>
              )}
              {!!draftImage && <View style={styles.changePhoto}><Ionicons name="camera" color="#FFF" size={15} /><Text style={styles.changePhotoText}>Change photo</Text></View>}
            </Pressable>
            <View style={styles.editorUser}><Avatar uri={profile.avatar} size={42} /><View style={{ marginLeft: 10 }}><Text style={styles.username}>{profile.name}</Text><Text style={styles.location}>Sharing with everyone</Text></View></View>
            <TextInput value={draftCaption} onChangeText={setDraftCaption} placeholder="Write a caption..." placeholderTextColor="#777" multiline style={styles.captionInput} />
            <Text style={styles.helperText}>Tip: A great caption makes a moment memorable.</Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* --- EDIT PROFILE MODAL --- */}
      <Modal visible={modal === "profile"} animationType="slide" transparent onRequestClose={() => setModal("")}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.commentBackdrop}>
          <View style={styles.commentSheet}>
            <View style={styles.sheetHandle} />
            <View style={[styles.modalHeader, { borderBottomWidth: 0 }]}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <Pressable onPress={saveProfile}><Text style={styles.shareText}>Save</Text></Pressable>
            </View>
            
            <ScrollView contentContainerStyle={{ alignItems: "center", paddingBottom: 20 }}>
              <Pressable onPress={() => pickImage(true)} style={{ marginBottom: 20 }}>
                <Avatar uri={draftProfile?.avatar} size={90} />
                <View style={styles.changePhotoOverlay}><Ionicons name="camera" color="#FFF" size={20} /></View>
              </Pressable>

              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput 
                value={draftProfile?.fullName} 
                onChangeText={(t) => setDraftProfile(prev => ({ ...prev, fullName: t }))} 
                style={styles.profileInput} 
                placeholder="Your Name" 
                placeholderTextColor="#777"
              />

              <Text style={styles.inputLabel}>Bio</Text>
              <TextInput 
                value={draftProfile?.bio} 
                onChangeText={(t) => setDraftProfile(prev => ({ ...prev, bio: t }))} 
                style={[styles.profileInput, { height: 80, textAlignVertical: 'top' }]} 
                placeholder="Tell us about yourself" 
                placeholderTextColor="#777"
                multiline
              />
            </ScrollView>
            
            <Pressable style={styles.closeSheet} onPress={() => setModal("")}><Text style={styles.secondaryButtonText}>Cancel</Text></Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* --- COMMENTS MODAL --- */}
      <Modal visible={modal === "comments"} animationType="slide" transparent onRequestClose={() => setModal("")}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.commentBackdrop}>
          <View style={styles.commentSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.modalTitle}>Comments</Text>
            <ScrollView style={{ maxHeight: 330 }} contentContainerStyle={{ paddingVertical: 14 }}>
              {(commentPost?.comments || []).map(c => <View key={String(c.id)} style={styles.commentRow}><Avatar uri={profile.avatar} size={32} /><Text style={styles.commentText}><Text style={styles.username}>{c.user} </Text>{c.text}</Text></View>)}
              {!commentPost?.comments?.length && <Text style={styles.emptyText}>Be the first to comment.</Text>}
            </ScrollView>
            <View style={styles.commentComposer}><TextInput value={commentText} onChangeText={setCommentText} placeholder="Add a comment..." placeholderTextColor="#777" style={styles.commentInput} /><Pressable onPress={submitComment}><Text style={styles.shareText}>Post</Text></Pressable></View>
            <Pressable style={styles.closeSheet} onPress={() => setModal("")}><Text style={styles.secondaryButtonText}>Close</Text></Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B0B0F" },
  header: { height: 58, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#202027" },
  logo: { color: "#F7F7FA", fontSize: 29, fontWeight: "900", letterSpacing: -1.4 },
  logoDot: { color: "#A78BFA" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconButton: { padding: 3, alignItems: "center", justifyContent: "center" },
  stories: { paddingHorizontal: 14, paddingVertical: 16, gap: 15, borderBottomWidth: 1, borderBottomColor: "#202027" },
  story: { width: 66, alignItems: "center" },
  storyImageWrap: { marginBottom: 6 },
  avatarWrap: { alignItems: "center", justifyContent: "center", borderRadius: 100 },
  storyRing: { borderWidth: 2, borderColor: "#A78BFA" },
  addStory: { position: "absolute", right: -1, bottom: -1, width: 20, height: 20, borderRadius: 10, backgroundColor: "#8B5CF6", borderWidth: 2, borderColor: "#0B0B0F", alignItems: "center", justifyContent: "center" },
  storyName: { color: "#B9B9C2", fontSize: 10, maxWidth: 66 },
  postCard: { paddingBottom: 17, borderBottomWidth: 1, borderBottomColor: "#202027" },
  postHeader: { height: 62, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  userLine: { flexDirection: "row", alignItems: "center", flex: 1 },
  username: { color: "#F4F4F6", fontSize: 13, fontWeight: "700" },
  location: { color: "#9999A4", fontSize: 11, marginTop: 3 },
  postImage: { width: "100%", aspectRatio: 0.96, backgroundColor: "#191920" },
  postActions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 13, paddingTop: 9 },
  actionGroup: { flexDirection: "row", gap: 13 },
  likes: { color: "#F4F4F6", fontWeight: "700", fontSize: 12, marginHorizontal: 16, marginTop: 4 },
  caption: { color: "#D4D4DA", fontSize: 12, lineHeight: 18, marginHorizontal: 16, marginTop: 6 },
  viewComments: { color: "#858590", fontSize: 12, marginHorizontal: 16, marginTop: 6 },
  time: { color: "#686873", fontSize: 9, textTransform: "uppercase", marginHorizontal: 16, marginTop: 7 },
  tabBar: { position: "absolute", bottom: 0, left: 0, right: 0, height: 67, paddingBottom: Platform.OS === "ios" ? 8 : 4, backgroundColor: "#111116", borderTopWidth: 1, borderTopColor: "#25252D", flexDirection: "row", justifyContent: "space-around", alignItems: "center" },
  tabItem: { alignItems: "center", justifyContent: "center", minWidth: 54, gap: 3 },
  tabText: { color: "#777782", fontSize: 9 },
  tabTextActive: { color: "#B9A5FF", fontWeight: "700" },
  searchBox: { flexDirection: "row", alignItems: "center", margin: 15, paddingHorizontal: 13, height: 45, borderRadius: 13, backgroundColor: "#191920", gap: 8 },
  searchInput: { flex: 1, color: "#FFF", fontSize: 13 },
  exploreGrid: { paddingHorizontal: 8, paddingBottom: 90 },
  exploreItem: { flex: 1, margin: 4, aspectRatio: 0.82, backgroundColor: "#1A1A22", borderRadius: 8, overflow: "hidden" },
  exploreImage: { width: "100%", height: "100%" },
  exploreOverlay: { position: "absolute", bottom: 8, left: 8, flexDirection: "row", alignItems: "center", gap: 5 },
  exploreLikes: { color: "#FFF", fontWeight: "700", fontSize: 11 },
  activityWrap: { padding: 20 },
  sectionTitle: { color: "#F5F5F7", fontSize: 25, fontWeight: "800" },
  sectionSubtitle: { color: "#858590", marginTop: 5, marginBottom: 22, fontSize: 12 },
  activityRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: "#202027" },
  activityIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  activityTitle: { color: "#F3F3F5", fontSize: 12, fontWeight: "700" },
  activitySub: { color: "#898994", fontSize: 11, marginTop: 4, lineHeight: 16 },
  activityTime: { color: "#6F6F79", fontSize: 9 },
  profileTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 24 },
  statsRow: { flex: 1, flexDirection: "row", justifyContent: "space-evenly" },
  stat: { alignItems: "center" },
  statValue: { color: "#F5F5F7", fontWeight: "800", fontSize: 17 },
  statLabel: { color: "#9999A4", fontSize: 10, marginTop: 4 },
  profileName: { color: "#F5F5F7", fontWeight: "800", fontSize: 14, marginHorizontal: 20, marginTop: 17 },
  bio: { color: "#B8B8C2", fontSize: 12, lineHeight: 19, marginHorizontal: 20, marginTop: 6 },
  profileButtons: { flexDirection: "row", gap: 9, marginHorizontal: 20, marginTop: 17 },
  primaryButton: { backgroundColor: "#8B5CF6", paddingHorizontal: 18, paddingVertical: 10, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  primaryButtonText: { color: "#FFF", fontWeight: "700", fontSize: 11 },
  secondaryButton: { backgroundColor: "#22222B", paddingHorizontal: 18, paddingVertical: 10, borderRadius: 9, flex: 1, alignItems: "center" },
  secondaryButtonText: { color: "#E4E4EA", fontWeight: "700", fontSize: 11 },
  gridHeader: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 15, marginTop: 16, borderTopWidth: 1, borderTopColor: "#24242C" },
  gridLabel: { color: "#B8B8C2", fontSize: 10, fontWeight: "800", letterSpacing: 1.3 },
  photoGrid: { flexDirection: "row", flexWrap: "wrap" },
  gridItem: { width: "33.333%", aspectRatio: 1, padding: 1 },
  gridImage: { width: "100%", height: "100%", backgroundColor: "#1B1B23" },
  emptyState: { width: "100%", alignItems: "center", paddingVertical: 38, gap: 10 },
  emptyTitle: { color: "#F3F3F5", fontWeight: "700", fontSize: 14 },
  emptyText: { color: "#858590", fontSize: 12, textAlign: "center", marginTop: 8 },
  modalSafe: { flex: 1, backgroundColor: "#0B0B0F" },
  modalHeader: { height: 58, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#25252D" },
  modalTitle: { color: "#F5F5F7", fontSize: 15, fontWeight: "800" },
  shareText: { color: "#B9A5FF", fontSize: 13, fontWeight: "800" },
  editorContent: { padding: 18 },
  imagePicker: { width: "100%", aspectRatio: 0.95, borderRadius: 16, overflow: "hidden", backgroundColor: "#17171F", borderWidth: 1, borderColor: "#30303B", borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  previewImage: { width: "100%", height: "100%" },
  imagePlaceholder: { alignItems: "center", gap: 9 },
  imagePlaceholderTitle: { color: "#F3F3F5", fontWeight: "700", fontSize: 15 },
  imagePlaceholderSub: { color: "#858590", fontSize: 11 },
  changePhoto: { position: "absolute", bottom: 12, right: 12, flexDirection: "row", gap: 6, alignItems: "center", backgroundColor: "#111116CC", paddingHorizontal: 11, paddingVertical: 8, borderRadius: 20 },
  changePhotoText: { color: "#FFF", fontSize: 10, fontWeight: "700" },
  changePhotoOverlay: { position: "absolute", bottom: 0, right: 0, backgroundColor: "#8B5CF6", width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#0B0B0F" },
  editorUser: { flexDirection: "row", alignItems: "center", marginTop: 20 },
  captionInput: { minHeight: 110, color: "#F5F5F7", fontSize: 14, textAlignVertical: "top", paddingTop: 18, borderBottomWidth: 1, borderBottomColor: "#292933" },
  helperText: { color: "#777782", fontSize: 10, marginTop: 10 },
  commentBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "#0009" },
  commentSheet: { backgroundColor: "#17171F", borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingBottom: 28 },
  sheetHandle: { width: 38, height: 4, borderRadius: 5, backgroundColor: "#555560", alignSelf: "center", marginBottom: 16 },
  commentRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  commentText: { color: "#D5D5DC", fontSize: 12, flex: 1, lineHeight: 18 },
  commentComposer: { flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: 1, borderTopColor: "#30303A", paddingTop: 12 },
  commentInput: { flex: 1, color: "#FFF", backgroundColor: "#25252E", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 12 },
  closeSheet: { alignSelf: "center", padding: 12, marginTop: 4 },
  
  inputLabel: { alignSelf: "flex-start", color: "#9999A4", fontSize: 11, fontWeight: "700", marginTop: 10, marginBottom: 5, marginLeft: 10 },
  profileInput: { width: "100%", backgroundColor: "#25252E", color: "#FFF", borderRadius: 12, paddingHorizontal: 15, paddingVertical: 12, fontSize: 14, marginBottom: 10 },
  
  optionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, gap: 15 },
  optionText: { color: '#FFF', fontSize: 16, fontWeight: '500' }
});