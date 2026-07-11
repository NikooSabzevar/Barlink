import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { socialApi } from '../../../lib/api';
import { useAuthStore } from '../../../store/authStore';
import { getSocket, subscribeToUserRoom, unsubscribeChat } from '../../../lib/socket';

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  body: string;
  createdAt: string;
  sender: { id: string; displayName: string };
}

export default function ChatScreen() {
  const { userId: otherUserId, barId, displayName } = useLocalSearchParams<{
    userId: string;
    barId: string;
    displayName: string;
  }>();
  const navigation = useNavigation();
  const currentUser = useAuthStore((s) => s.user);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [chatBlocked, setChatBlocked] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (displayName) navigation.setOptions({ title: displayName });
    fetchThread();
    setupSocket();
    return () => unsubscribeChat();
  }, [otherUserId, barId]);

  async function fetchThread() {
    try {
      const res = await socialApi.getThread(otherUserId!, barId!);
      setMessages(res.data);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  async function setupSocket() {
    if (!currentUser) return;
    await getSocket();
    subscribeToUserRoom(currentUser.id, {
      onMessage: (msg: Message) => {
        if (
          (msg.senderId === otherUserId && msg.receiverId === currentUser.id) ||
          (msg.senderId === currentUser.id && msg.receiverId === otherUserId)
        ) {
          setMessages((prev) => [...prev, msg]);
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
      },
      onChatBlocked: () => {
        setChatBlocked(true);
        Alert.alert(
          '🚫 Chat Unavailable',
          'You have left the venue. Chat is only available while you are inside.',
        );
      },
    });
  }

  async function handleSend() {
    if (!text.trim() || !currentUser || chatBlocked) return;
    setSending(true);
    try {
      const res = await socialApi.sendMessage(barId!, otherUserId!, text.trim());
      setMessages((prev) => [...prev, res.data]);
      setText('');
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Failed to send.';
      if (msg.toLowerCase().includes('inside')) setChatBlocked(true);
      Alert.alert('Cannot Send', msg);
    } finally {
      setSending(false);
    }
  }

  function renderMessage({ item }: { item: Message }) {
    const isMe = item.senderId === currentUser?.id;
    return (
      <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
        {!isMe && (
          <Text style={styles.senderName}>{item.sender?.displayName}</Text>
        )}
        <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{item.body}</Text>
        <Text style={styles.timestamp}>
          {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#a78bfa" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {chatBlocked && (
        <View style={styles.blockedBanner}>
          <Text style={styles.blockedText}>🚫 Chat blocked — you are no longer inside the venue</Text>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Text style={styles.emptyChatIcon}>💬</Text>
            <Text style={styles.emptyChatText}>No messages yet. Say hi!</Text>
          </View>
        }
      />

      <View style={[styles.inputRow, chatBlocked && styles.inputRowBlocked]}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={chatBlocked ? 'Chat unavailable outside venue' : 'Type a message...'}
          placeholderTextColor="#4b5563"
          editable={!chatBlocked}
          multiline
          maxLength={500}
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || chatBlocked) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!text.trim() || sending || chatBlocked}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.sendBtnText}>↑</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f1a' },
  blockedBanner: {
    backgroundColor: '#ef444422',
    borderBottomWidth: 1,
    borderBottomColor: '#ef4444',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  blockedText: { color: '#ef4444', fontSize: 13, textAlign: 'center' },
  messageList: { padding: 16, paddingBottom: 8 },
  bubble: {
    maxWidth: '78%',
    marginBottom: 10,
    borderRadius: 16,
    padding: 12,
  },
  bubbleMe: {
    backgroundColor: '#7c3aed',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: '#1c1c2e',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  senderName: { color: '#a78bfa', fontSize: 11, fontWeight: '700', marginBottom: 4 },
  bubbleText: { color: '#d1d5db', fontSize: 15, lineHeight: 20 },
  bubbleTextMe: { color: '#fff' },
  timestamp: { color: '#ffffff55', fontSize: 10, marginTop: 4, textAlign: 'right' },
  emptyChat: { flex: 1, alignItems: 'center', paddingTop: 60 },
  emptyChatIcon: { fontSize: 40, marginBottom: 12 },
  emptyChatText: { color: '#4b5563', fontSize: 15 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#1c1c2e',
    gap: 8,
  },
  inputRowBlocked: { opacity: 0.5 },
  input: {
    flex: 1,
    backgroundColor: '#1c1c2e',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 15,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#374151',
  },
  sendBtn: {
    backgroundColor: '#7c3aed',
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#374151' },
  sendBtnText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
});
