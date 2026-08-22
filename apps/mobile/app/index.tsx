import { Link } from 'expo-router'
import { SafeAreaView, StyleSheet, Text, View } from 'react-native'

const tasks = [
  ['Sales orders', '12 awaiting confirmation'],
  ['Deliveries', '5 routes due today'],
  ['Stock alerts', '3 batches need attention'],
]

export default function MobileHome() {
  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.eyebrow}>PHARMAERP · FIELD OPERATIONS</Text>
      <Text style={styles.title}>Good morning</Text>
      <Text style={styles.copy}>Fast, focused work for the warehouse and delivery teams.</Text>
      <View style={styles.list}>
        {tasks.map(([label, detail]) => <View key={label} style={styles.task}><Text style={styles.taskTitle}>{label}</Text><Text style={styles.taskDetail}>{detail}</Text></View>)}
      </View>
      <Link href="/" style={styles.link}>Refresh workspace</Link>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc', padding: 24, gap: 10 },
  eyebrow: { color: '#4f46e5', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginTop: 16 },
  title: { color: '#111827', fontSize: 30, fontWeight: '700' },
  copy: { color: '#64748b', fontSize: 15, lineHeight: 22 },
  list: { gap: 12, marginTop: 18 },
  task: { backgroundColor: '#fff', borderColor: '#e2e8f0', borderWidth: 1, borderRadius: 14, padding: 16 },
  taskTitle: { color: '#111827', fontSize: 16, fontWeight: '700' },
  taskDetail: { color: '#64748b', fontSize: 13, marginTop: 4 },
  link: { color: '#4f46e5', fontWeight: '700', marginTop: 12 },
})
