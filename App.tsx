import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, View, Text, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { initDb, listAcademic, listInventory, listSubjects, changeInventory } from './src/db';
import { MockPronoteApi, syncPronote } from './src/pronote';
import { scheduleEveningReminder } from './src/notifications';
import type { AcademicItem, InventoryItem, Subject } from './src/types';
import { t, type Locale } from './src/i18n';

const api = new MockPronoteApi();
const days = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];

function AppContent() {
  const db = useSQLiteContext();
  const [tab, setTab] = useState<'home'|'room'|'planner'|'grades'|'settings'>('home');
  const [items, setItems] = useState<AcademicItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [locale, setLocale] = useState<Locale>('fr');

  const refresh = async () => { setItems(await listAcademic(db)); setInventory(await listInventory(db)); setSubjects(await listSubjects(db)); };
  useEffect(() => { refresh(); }, []);
  const subjectMap = useMemo(() => Object.fromEntries(subjects.map(s => [s.id,s])), [subjects]);
  const upcoming = items.filter(x => new Date(x.startsAt) >= new Date()).slice(0,8);

  async function sync() {
    const from = new Date(); const to = new Date(Date.now()+7*86400000);
    const n = await syncPronote(api, db, from.toISOString(), to.toISOString()); await refresh();
    Alert.alert('Pronote', `${n} éléments synchronisés.`);
  }

  async function reminder() {
    const text = upcoming.slice(0,3).map(x => `• ${x.title}`).join('\n') || 'Aucun cours prévu.';
    const ok = await scheduleEveningReminder(`Demain / à venir :\n${text}`); Alert.alert('Notifications', ok ? 'Rappel quotidien activé à 19h.' : 'Permission refusée.');
  }

  return <SafeAreaView style={styles.root}>
    <View style={styles.header}><Text style={styles.logo}>Student Planner</Text><Text style={styles.date}>{days[new Date().getDay()]} {new Date().getDate()}</Text></View>
    <ScrollView contentContainerStyle={styles.content}>
      {tab==='home' && <Home items={upcoming} inventory={inventory} subjectMap={subjectMap} onSync={sync} />}
      {tab==='room' && <Room inventory={inventory} onChange={async(id,d)=>{await changeInventory(db,id,d);refresh();}} />}
      {tab==='planner' && <Planner items={items} subjectMap={subjectMap} />}
      {tab==='grades' && <Grades />}
      {tab==='settings' && <Settings locale={locale} setLocale={setLocale} onReminder={reminder} />}
    </ScrollView>
    <View style={styles.tabs}>{(['home','room','planner','grades','settings'] as const).map(x => <Pressable key={x} style={styles.tab} onPress={()=>setTab(x)}><Text style={[styles.tabText,tab===x&&styles.active]}>{t(locale,x)}</Text></Pressable>)}</View>
  </SafeAreaView>;
}

function Home({items,inventory,subjectMap,onSync}:{items:AcademicItem[],inventory:InventoryItem[],subjectMap:Record<string,Subject>,onSync:()=>void}) { return <>
  <Text style={styles.title}>Bonjour</Text><Text style={styles.subtitle}>Voici ce qui t'attend.</Text>
  <View style={styles.actions}><Pressable style={styles.primary} onPress={onSync}><Text style={styles.primaryText}>↻ Synchroniser Pronote</Text></Pressable></View>
  <Text style={styles.section}>À venir</Text>{items.length===0?<Text style={styles.muted}>Aucun élément. Lance une synchronisation.</Text>:items.slice(0,5).map(x=><Card key={x.id}><Text style={styles.cardTitle}>{x.title}</Text><Text style={styles.muted}>{new Date(x.startsAt).toLocaleString('fr-FR',{weekday:'short',hour:'2-digit',minute:'2-digit'})}{x.location?` · ${x.location}`:''}</Text>{x.subjectId&&<Text style={{color:subjectMap[x.subjectId]?.color,fontWeight:'700'}}>{subjectMap[x.subjectId]?.name}</Text>}</Card>)}
  <Text style={styles.section}>Stock faible</Text>{inventory.filter(x=>x.quantity<=x.lowStockThreshold).map(x=><Card key={x.id}><Text style={styles.cardTitle}>{x.name}</Text><Text style={styles.muted}>{x.quantity} restant(s)</Text></Card>)}
</> }
function Room({inventory,onChange}:{inventory:InventoryItem[],onChange:(id:string,d:number)=>void}) { return <><Text style={styles.title}>Ma chambre</Text><Text style={styles.subtitle}>Inventaire rapide</Text>{inventory.map(x=><Card key={x.id}><View style={styles.row}><View><Text style={styles.cardTitle}>{x.name}</Text><Text style={styles.muted}>{x.category} · seuil {x.lowStockThreshold}</Text></View><View style={styles.stepper}><Pressable onPress={()=>onChange(x.id,-1)} style={styles.circle}><Text>−</Text></Pressable><Text style={styles.qty}>{x.quantity}</Text><Pressable onPress={()=>onChange(x.id,1)} style={styles.circle}><Text>+</Text></Pressable></View></View></Card>)}</> }
function Planner({items,subjectMap}:{items:AcademicItem[],subjectMap:Record<string,Subject>}) { return <><Text style={styles.title}>Planning</Text><Text style={styles.subtitle}>Cours, devoirs et khôlles</Text>{items.map(x=><Card key={x.id}><View style={styles.row}><View style={{flex:1}}><Text style={styles.cardTitle}>{x.title}</Text><Text style={styles.muted}>{new Date(x.startsAt).toLocaleString('fr-FR',{weekday:'long',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</Text>{x.location&&<Text style={styles.muted}>{x.location}</Text>}</View><Text style={styles.badge}>{x.origin==='pronote'?'Pronote':'Manuel'}</Text></View>{x.subjectId&&<Text style={{marginTop:6,color:subjectMap[x.subjectId]?.color,fontWeight:'700'}}>{subjectMap[x.subjectId]?.name}</Text>}</Card>)}</> }
function Grades(){return <><Text style={styles.title}>Notes</Text><Text style={styles.subtitle}>Suivi des résultats sur 20</Text><Card><Text style={styles.cardTitle}>Aucune note</Text><Text style={styles.muted}>L'ajout et le calcul pondéré sont prêts à être branchés sur le formulaire de notes.</Text></Card></>}
function Settings({locale,setLocale,onReminder}:{locale:Locale,setLocale:(l:Locale)=>void,onReminder:()=>void}){return <><Text style={styles.title}>Réglages</Text><Text style={styles.subtitle}>Données locales et intégrations</Text><Card><Text style={styles.cardTitle}>Langue</Text><View style={styles.row}><Pressable onPress={()=>setLocale('fr')}><Text style={locale==='fr'?styles.active:styles.muted}>Français</Text></Pressable><Pressable onPress={()=>setLocale('en')}><Text style={locale==='en'?styles.active:styles.muted}>English</Text></Pressable></View></Card><Card><Text style={styles.cardTitle}>Pronote</Text><Text style={styles.muted}>Adapter Mock actif. Les identifiants réels seront gérés par une future passerelle locale.</Text></Card><Card><Text style={styles.cardTitle}>Notifications</Text><Pressable style={styles.primary} onPress={onReminder}><Text style={styles.primaryText}>Activer le rappel de 19h</Text></Pressable></Card></>}
function Card({children}:{children:React.ReactNode}){return <View style={styles.card}>{children}</View>}

export default function App(){return <SQLiteProvider databaseName="student-planner.db" onInit={initDb}><AppContent/></SQLiteProvider>}

const styles=StyleSheet.create({root:{flex:1,backgroundColor:'#f6f7fb'},header:{paddingHorizontal:20,paddingTop:10,paddingBottom:8,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},logo:{fontSize:20,fontWeight:'800'},date:{color:'#6b7280'},content:{padding:20,paddingBottom:100},title:{fontSize:32,fontWeight:'800',marginTop:8},subtitle:{fontSize:16,color:'#6b7280',marginTop:4,marginBottom:20},section:{fontSize:20,fontWeight:'800',marginTop:24,marginBottom:10},actions:{marginBottom:4},primary:{backgroundColor:'#111827',padding:13,borderRadius:12,alignItems:'center'},primaryText:{color:'#fff',fontWeight:'700'},card:{backgroundColor:'#fff',borderRadius:16,padding:16,marginBottom:10,shadowOpacity:.04,shadowRadius:8},cardTitle:{fontSize:16,fontWeight:'700'},muted:{color:'#6b7280',marginTop:4},row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},stepper:{flexDirection:'row',alignItems:'center',gap:10},circle:{width:34,height:34,borderRadius:17,backgroundColor:'#eef0f5',alignItems:'center',justifyContent:'center'},qty:{fontWeight:'800',minWidth:20,textAlign:'center'},badge:{backgroundColor:'#eef0f5',paddingHorizontal:8,paddingVertical:5,borderRadius:8,fontSize:11},tabs:{position:'absolute',bottom:0,left:0,right:0,height:76,backgroundColor:'#fff',borderTopWidth:1,borderTopColor:'#e5e7eb',flexDirection:'row',justifyContent:'space-around',paddingTop:12},tab:{flex:1,alignItems:'center'},tabText:{fontSize:11,color:'#6b7280',textTransform:'capitalize'},active:{color:'#111827',fontWeight:'800'}});
