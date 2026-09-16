import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { addGrade, addInventory, addManualItem, changeInventory, deleteGrade, deleteInventory, deleteManualItem, exportData, getStudentGroups, initDb, listAcademic, listGrades, listInventory, listSubjects, replaceGeneratedItems, replaceTimetableItems, saveStudentGroups, toggleAcademicItem, updateGrade, updateInventory, updateManualItem } from './src/db';
import { importScopeForStudent, importTimetableDocument, scanTimetableImage } from './src/groupImport';
import { scheduleEveningReminder } from './src/notifications';
import { t, type Locale } from './src/i18n';
import type { AcademicItem, AcademicType, Grade, GradeType, InventoryItem, StudentGroups, Subject } from './src/types';

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const formatDate = (v:string,l:Locale) => new Date(v).toLocaleString(l === 'fr' ? 'fr-FR' : 'en-US', { weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
type Tab = 'home'|'room'|'planner'|'grades'|'settings';

function AppContent() {
  const db = useSQLiteContext();
  const [tab,setTab] = useState<Tab>('home');
  const [locale,setLocale] = useState<Locale>('fr');
  const [items,setItems] = useState<AcademicItem[]>([]);
  const [inventory,setInventory] = useState<InventoryItem[]>([]);
  const [grades,setGrades] = useState<Grade[]>([]);
  const [subjects,setSubjects] = useState<Subject[]>([]);
  const [groups,setGroups] = useState<StudentGroups>({});
  const [inventoryForm,setInventoryForm] = useState<InventoryItem|null|false>(false);
  const [academicForm,setAcademicForm] = useState<AcademicItem|null|false>(false);
  const [gradeForm,setGradeForm] = useState<Grade|null|false>(false);

  const refresh = async () => {
    const [a,i,g,s,p] = await Promise.all([listAcademic(db),listInventory(db),listGrades(db),listSubjects(db),getStudentGroups(db)]);
    setItems(a); setInventory(i); setGrades(g); setSubjects(s); setGroups(p);
  };
  useEffect(() => { refresh().catch(e => Alert.alert('Erreur',String(e))); }, []);
  const subjectMap = useMemo(() => Object.fromEntries(subjects.map(s => [s.id,s])), [subjects]);
  const upcoming = items.filter(x => new Date(x.startsAt).getTime() >= Date.now()).sort((a,b) => a.startsAt.localeCompare(b.startsAt));

  const importScope = async () => {
    try {
      if (!Object.values(groups).some(Boolean)) { Alert.alert('Profil incomplet','Renseigne au moins un groupe ou ton trinôme avant l’import.'); return; }
      const result = await importScopeForStudent(groups);
      if (!result) return;
      if (!result.items.length) { Alert.alert('Aucun résultat','Aucun créneau du colloscope / TP-scope ne correspond à ton profil.'); return; }
      await replaceGeneratedItems(db,result.document,result.items); await refresh();
      Alert.alert('Planning mis à jour',`${result.items.length} créneau(x) de colloscope / TP-scope importé(s).`);
    } catch (e) { Alert.alert('Import impossible',String(e)); }
  };

  const importTimetable = async () => {
    try {
      const result = await importTimetableDocument();
      if (!result) return;
      if (!result.items.length) { Alert.alert('Aucun créneau','Le document ne contient pas de créneaux exploitables.'); return; }
      await replaceTimetableItems(db,result.document,result.items); await refresh();
      Alert.alert('Emploi du temps importé',`${result.items.length} créneau(x) ajouté(s).`);
    } catch (e) { Alert.alert('Import impossible',String(e)); }
  };

  const scanTimetable = async () => {
    try {
      const result = await scanTimetableImage();
      if (!result) return;
      if (!result.items.length) { Alert.alert('Aucun créneau','Le scan n’a pas permis de détecter un emploi du temps exploitable.'); return; }
      await replaceTimetableItems(db,result.document,result.items); await refresh();
      Alert.alert('Emploi du temps scanné',`${result.items.length} créneau(x) détecté(s).`);
    } catch (e) { Alert.alert('Scan impossible',String(e)); }
  };

  const reminder = async () => {
    const text = upcoming.slice(0,5).map(x => `• ${x.title}`).join('\n') || 'Aucun élément prévu.';
    const ok = await scheduleEveningReminder(text);
    Alert.alert(t(locale,'reminder'),ok ? 'Rappel quotidien activé à 19h.' : 'Permission de notification refusée.');
  };

  return <SafeAreaView style={S.root}>
    <View style={S.header}><Text style={S.logo}>Student Planner</Text><Text style={S.muted}>{new Date().toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US',{weekday:'short',day:'numeric',month:'short'})}</Text></View>
    <ScrollView contentContainerStyle={S.content}>
      {tab === 'home' && <Home locale={locale} items={upcoming} inventory={inventory} subjects={subjectMap} onScope={importScope} onTimetable={importTimetable} onScan={scanTimetable} onReminder={reminder}/>} 
      {tab === 'room' && <Room locale={locale} items={inventory} onAdd={()=>setInventoryForm(null)} onEdit={setInventoryForm} onDelete={async id=>{await deleteInventory(db,id);refresh();}} onChange={async(id,d)=>{await changeInventory(db,id,d);refresh();}}/>}
      {tab === 'planner' && <Planner locale={locale} items={items} subjects={subjectMap} onAdd={()=>setAcademicForm(null)} onEdit={setAcademicForm} onDelete={async id=>{await deleteManualItem(db,id);refresh();}} onToggle={async id=>{await toggleAcademicItem(db,id);refresh();}} onScope={importScope} onTimetable={importTimetable} onScan={scanTimetable}/>} 
      {tab === 'grades' && <Grades locale={locale} grades={grades} subjects={subjects} onAdd={()=>setGradeForm(null)} onEdit={setGradeForm} onDelete={async id=>{await deleteGrade(db,id);refresh();}}/>}
      {tab === 'settings' && <Settings locale={locale} groups={groups} setGroups={setGroups} onSaveGroups={async g=>{await saveStudentGroups(db,g);setGroups(g);Alert.alert('Profil','Groupes enregistrés.');}} onScope={importScope} onTimetable={importTimetable} onScan={scanTimetable} onReminder={reminder} onExport={async()=>Alert.alert(t(locale,'exportData'),JSON.stringify(await exportData(db),null,2))} setLocale={setLocale}/>} 
    </ScrollView>
    <View style={S.tabs}>{(['home','room','planner','grades','settings'] as Tab[]).map(x=><Pressable key={x} style={S.tab} onPress={()=>setTab(x)}><Text style={[S.tabText,tab===x&&S.active]}>{t(locale,x)}</Text></Pressable>)}</View>
    <InventoryModal visible={inventoryForm !== false} initial={inventoryForm || undefined} locale={locale} onClose={()=>setInventoryForm(false)} onSave={async x=>{x.id=x.id||uid();if(inventoryForm&&inventoryForm!==null)await updateInventory(db,x);else await addInventory(db,x);setInventoryForm(false);refresh();}}/>
    <AcademicModal visible={academicForm !== false} initial={academicForm || undefined} locale={locale} subjects={subjects} onClose={()=>setAcademicForm(false)} onSave={async x=>{x.id=x.id||uid();if(academicForm&&academicForm!==null)await updateManualItem(db,x);else await addManualItem(db,x);setAcademicForm(false);refresh();}}/>
    <GradeModal visible={gradeForm !== false} initial={gradeForm || undefined} locale={locale} subjects={subjects} onClose={()=>setGradeForm(false)} onSave={async x=>{x.id=x.id||uid();if(gradeForm&&gradeForm!==null)await updateGrade(db,x);else await addGrade(db,x);setGradeForm(false);refresh();}}/>
  </SafeAreaView>;
}

function Home(p:{locale:Locale,items:AcademicItem[],inventory:InventoryItem[],subjects:Record<string,Subject>,onScope:()=>void,onTimetable:()=>void,onScan:()=>void,onReminder:()=>void}) { return <>
  <Text style={S.title}>{p.locale === 'fr' ? 'Bonjour' : 'Hello'}</Text>
  <Text style={S.subtitle}>{p.locale === 'fr' ? 'Emploi du temps + colloscope / TP-scope + tes événements manuels.' : 'Timetable + khôlle / TP scope + your manual events.'}</Text>
  <View style={S.actions}><Pressable style={S.primary} onPress={p.onScan}><Text style={S.primaryText}>{t(p.locale,'scanTimetable')}</Text></Pressable><Pressable style={S.secondary} onPress={p.onTimetable}><Text style={S.secondaryText}>{t(p.locale,'importTimetable')}</Text></Pressable><Pressable style={S.primary} onPress={p.onScope}><Text style={S.primaryText}>{t(p.locale,'importScope')}</Text></Pressable><Pressable style={S.secondary} onPress={p.onReminder}><Text style={S.secondaryText}>{t(p.locale,'reminder')}</Text></Pressable></View>
  <Card><Text style={S.cardTitle}>{t(p.locale,'precedence')}</Text></Card>
  <Text style={S.section}>{t(p.locale,'upcoming')}</Text>
  {p.items.slice(0,8).map(x=><AcademicCard key={x.id} x={x} subjects={p.subjects} locale={p.locale}/>)}
  {!p.items.length && <Card><Text>{t(p.locale,'noEvents')}</Text></Card>}
  <Text style={S.section}>{t(p.locale,'lowStock')}</Text>{p.inventory.filter(x=>x.quantity<=x.lowStockThreshold).map(x=><Card key={x.id}><Text style={S.cardTitle}>{x.name}</Text><Text style={S.muted}>{x.quantity} / seuil {x.lowStockThreshold}</Text></Card>)}
</>; }

function AcademicCard({x,subjects,locale}:{x:AcademicItem,subjects:Record<string,Subject>,locale:Locale}) { const label=x.origin==='generated'?'Colloscope / TP-scope':x.origin==='timetable'?'Emploi du temps':'Manuel'; return <Card><View style={S.row}><View style={{flex:1}}><Text style={S.cardTitle}>{x.title}</Text><Text style={S.muted}>{formatDate(x.startsAt,locale)}{x.location?` · ${x.location}`:''}</Text>{x.subjectId&&<Text style={{color:subjects[x.subjectId]?.color,fontWeight:'700'}}>{subjects[x.subjectId]?.name}</Text>}</View><Text style={S.badge}>{label}</Text></View></Card>; }

function Room(p:{locale:Locale,items:InventoryItem[],onAdd:()=>void,onEdit:(x:InventoryItem)=>void,onDelete:(id:string)=>void,onChange:(id:string,d:number)=>void}) { return <><View style={S.row}><View><Text style={S.title}>{t(p.locale,'room')}</Text><Text style={S.subtitle}>Inventaire local</Text></View><Pressable style={S.primarySmall} onPress={p.onAdd}><Text style={S.primaryText}>+ {t(p.locale,'add')}</Text></Pressable></View>{p.items.map(x=><Card key={x.id}><View style={S.row}><View style={{flex:1}}><Text style={S.cardTitle}>{x.name}</Text><Text style={S.muted}>{x.category} · seuil {x.lowStockThreshold}</Text></View><View style={S.stepper}><Pressable style={S.circle} onPress={()=>p.onChange(x.id,-1)}><Text>−</Text></Pressable><Text style={S.qty}>{x.quantity}</Text><Pressable style={S.circle} onPress={()=>p.onChange(x.id,1)}><Text>+</Text></Pressable></View></View><View style={S.inlineActions}><Pressable onPress={()=>p.onEdit(x)}><Text style={S.link}>{t(p.locale,'edit')}</Text></Pressable><Pressable onPress={()=>p.onDelete(x.id)}><Text style={S.danger}>{t(p.locale,'delete')}</Text></Pressable></View></Card>)}</>; }

function Planner(p:{locale:Locale,items:AcademicItem[],subjects:Record<string,Subject>,onAdd:()=>void,onEdit:(x:AcademicItem)=>void,onDelete:(id:string)=>void,onToggle:(id:string)=>void,onScope:()=>void,onTimetable:()=>void,onScan:()=>void}) { const sorted=[...p.items].sort((a,b)=>a.startsAt.localeCompare(b.startsAt)); return <><View style={S.row}><View><Text style={S.title}>{t(p.locale,'planner')}</Text><Text style={S.subtitle}>Cours, TP, khôlles, devoirs et événements</Text></View><Pressable style={S.primarySmall} onPress={p.onAdd}><Text style={S.primaryText}>+ {t(p.locale,'add')}</Text></Pressable></View><View style={S.actions}><Pressable style={S.secondary} onPress={p.onScan}><Text style={S.secondaryText}>{t(p.locale,'scanTimetable')}</Text></Pressable><Pressable style={S.secondary} onPress={p.onTimetable}><Text style={S.secondaryText}>{t(p.locale,'importTimetable')}</Text></Pressable><Pressable style={S.primary} onPress={p.onScope}><Text style={S.primaryText}>{t(p.locale,'importScope')}</Text></Pressable></View>{sorted.map(x=><Card key={x.id}><View style={S.row}><Pressable style={{flex:1}} onPress={()=>x.origin==='manual'&&p.onToggle(x.id)}><Text style={[S.cardTitle,x.completed&&S.strike]}>{x.completed?'✓ ':''}{x.title}</Text><Text style={S.muted}>{formatDate(x.startsAt,p.locale)}{x.location?` · ${x.location}`:''}</Text>{x.subjectId&&<Text style={{color:p.subjects[x.subjectId]?.color,fontWeight:'700'}}>{p.subjects[x.subjectId]?.name}</Text>}</Pressable><Text style={S.badge}>{x.origin==='generated'?'Colloscope / TP-scope':x.origin==='timetable'?'Emploi du temps':'Manuel'}</Text></View>{x.description&&<Text style={S.muted}>{x.description}</Text>}{x.origin==='manual'&&<View style={S.inlineActions}><Pressable onPress={()=>p.onEdit(x)}><Text style={S.link}>{t(p.locale,'edit')}</Text></Pressable><Pressable onPress={()=>p.onDelete(x.id)}><Text style={S.danger}>{t(p.locale,'delete')}</Text></Pressable></View>}</Card>)}</>; }

function Grades(p:{locale:Locale,grades:Grade[],subjects:Subject[],onAdd:()=>void,onEdit:(x:Grade)=>void,onDelete:(id:string)=>void}) { const avgs=p.subjects.map(s=>{const gs=p.grades.filter(g=>g.subjectId===s.id);const den=gs.reduce((a,g)=>a+g.coefficient,0);return{s,avg:den?gs.reduce((a,g)=>a+g.value*g.coefficient,0)/den:null};});const den=p.grades.reduce((a,g)=>a+g.coefficient,0);const global=den?p.grades.reduce((a,g)=>a+g.value*g.coefficient,0)/den:null;return <><View style={S.row}><View><Text style={S.title}>{t(p.locale,'grades')}</Text><Text style={S.subtitle}>{t(p.locale,'globalAverage')}: {global==null?'—':`${global.toFixed(2)}/20`}</Text></View><Pressable style={S.primarySmall} onPress={p.onAdd}><Text style={S.primaryText}>+ {t(p.locale,'add')}</Text></Pressable></View>{avgs.map(x=><Card key={x.s.id}><View style={S.row}><Text style={S.cardTitle}>{x.s.name}</Text><Text style={S.qty}>{x.avg==null?'—':`${x.avg.toFixed(2)}/20`}</Text></View></Card>)}{p.grades.map(g=><Card key={g.id}><View style={S.row}><View style={{flex:1}}><Text style={S.cardTitle}>{g.value}/20 × {g.coefficient}</Text><Text style={S.muted}>{p.subjects.find(s=>s.id===g.subjectId)?.name} · {g.date}</Text></View><View><Pressable onPress={()=>p.onEdit(g)}><Text style={S.link}>{t(p.locale,'edit')}</Text></Pressable><Pressable onPress={()=>p.onDelete(g.id)}><Text style={S.danger}>{t(p.locale,'delete')}</Text></Pressable></View></View></Card>)}</>; }

function Settings(p:{locale:Locale,groups:StudentGroups,setGroups:(g:StudentGroups)=>void,onSaveGroups:(g:StudentGroups)=>void,onScope:()=>void,onTimetable:()=>void,onScan:()=>void,onReminder:()=>void,onExport:()=>void,setLocale:(l:Locale)=>void}) { return <><Text style={S.title}>{t(p.locale,'settings')}</Text><Text style={S.subtitle}>Les groupes servent à filtrer le colloscope / TP-scope.</Text><GroupProfile groups={p.groups} onChange={p.setGroups} onSave={()=>p.onSaveGroups(p.groups)}/><Card><Text style={S.cardTitle}>{t(p.locale,'timetable')}</Text><Text style={S.muted}>Tu peux scanner une photo ou importer un PDF/Excel/CSV.</Text><View style={S.actions}><Pressable style={S.primary} onPress={p.onScan}><Text style={S.primaryText}>{t(p.locale,'scanTimetable')}</Text></Pressable><Pressable style={S.secondary} onPress={p.onTimetable}><Text style={S.secondaryText}>{t(p.locale,'importTimetable')}</Text></Pressable></View></Card><Card><Text style={S.cardTitle}>{t(p.locale,'scope')}</Text><Text style={S.muted}>Le colloscope / TP-scope prend toujours le dessus sur l’emploi du temps en cas de chevauchement. Les événements manuels ne sont jamais supprimés par les imports.</Text><Pressable style={S.primary} onPress={p.onScope}><Text style={S.primaryText}>{t(p.locale,'importScope')}</Text></Pressable></Card><Card><Text style={S.cardTitle}>{t(p.locale,'language')}</Text><View style={S.actions}><Pressable style={p.locale==='fr'?S.primary:S.secondary} onPress={()=>p.setLocale('fr')}><Text style={p.locale==='fr'?S.primaryText:S.secondaryText}>Français</Text></Pressable><Pressable style={p.locale==='en'?S.primary:S.secondary} onPress={()=>p.setLocale('en')}><Text style={p.locale==='en'?S.primaryText:S.secondaryText}>English</Text></Pressable></View></Card><Card><Text style={S.cardTitle}>{t(p.locale,'reminder')}</Text><Pressable style={S.primary} onPress={p.onReminder}><Text style={S.primaryText}>19:00</Text></Pressable></Card><Card><Text style={S.cardTitle}>{t(p.locale,'exportData')}</Text><Pressable style={S.secondary} onPress={p.onExport}><Text style={S.secondaryText}>{t(p.locale,'exportData')}</Text></Pressable></Card></>; }

function GroupProfile({groups,onChange,onSave}:{groups:StudentGroups,onChange:(g:StudentGroups)=>void,onSave:()=>void}) { const f=(key:keyof StudentGroups,label:string)=><Field label={label} value={groups[key]||''} onChange={v=>onChange({...groups,[key]:v})}/>; return <Card><Text style={S.cardTitle}>Mes groupes</Text>{f('group','Groupe principal')}{f('thirdGroup','Tiers-groupe')}{f('halfGroup','Demi-groupe')}{f('trinome','Trinôme')}<Pressable style={S.primary} onPress={onSave}><Text style={S.primaryText}>Enregistrer</Text></Pressable></Card>; }
function Field(p:{label:string,value:string,onChange:(v:string)=>void}) { return <View style={S.field}><Text style={S.label}>{p.label}</Text><TextInput style={S.input} value={p.value} onChangeText={p.onChange} placeholder={p.label}/></View>; }
function Card({children}:{children:React.ReactNode}) { return <View style={S.card}>{children}</View>; }

function InventoryModal(p:{visible:boolean,initial?:InventoryItem,locale:Locale,onClose:()=>void,onSave:(x:InventoryItem)=>void}) { const [x,setX]=useState<InventoryItem>(p.initial||{id:'',name:'',category:'',quantity:0,lowStockThreshold:1}); useEffect(()=>setX(p.initial||{id:'',name:'',category:'',quantity:0,lowStockThreshold:1}),[p.initial,p.visible]);return <Modal visible={p.visible} transparent animationType="slide"><View style={S.modal}><View style={S.sheet}><Text style={S.title}>{p.initial?t(p.locale,'edit'):t(p.locale,'add')}</Text><Field label={t(p.locale,'name')} value={x.name} onChange={v=>setX({...x,name:v})}/><Field label={t(p.locale,'category')} value={x.category} onChange={v=>setX({...x,category:v})}/><Field label={t(p.locale,'quantity')} value={String(x.quantity)} onChange={v=>setX({...x,quantity:Math.max(0,Number(v)||0)})}/><Field label={t(p.locale,'threshold')} value={String(x.lowStockThreshold)} onChange={v=>setX({...x,lowStockThreshold:Math.max(0,Number(v)||0)})}/><View style={S.actions}><Pressable style={S.primary} onPress={()=>x.name.trim()&&p.onSave(x)}><Text style={S.primaryText}>{t(p.locale,'save')}</Text></Pressable><Pressable style={S.secondary} onPress={p.onClose}><Text style={S.secondaryText}>{t(p.locale,'cancel')}</Text></Pressable></View></View></View></Modal>; }

function AcademicModal(p:{visible:boolean,initial?:AcademicItem,locale:Locale,subjects:Subject[],onClose:()=>void,onSave:(x:AcademicItem)=>void}) { const base=()=>({id:'',origin:'manual' as const,type:'event' as AcademicType,title:'',subjectId:p.subjects[0]?.id,startsAt:new Date().toISOString().slice(0,16),endsAt:new Date(Date.now()+3600000).toISOString().slice(0,16),completed:false}); const [x,setX]=useState<AcademicItem>(p.initial||base());useEffect(()=>setX(p.initial||base()),[p.initial,p.visible,p.subjects]);return <Modal visible={p.visible} transparent animationType="slide"><View style={S.modal}><View style={S.sheet}><Text style={S.title}>{p.initial?t(p.locale,'edit'):t(p.locale,'add')}</Text><Field label={t(p.locale,'title')} value={x.title} onChange={v=>setX({...x,title:v})}/><Field label={t(p.locale,'date')} value={x.startsAt} onChange={v=>setX({...x,startsAt:v})}/><Field label="Fin" value={x.endsAt} onChange={v=>setX({...x,endsAt:v})}/><Field label={t(p.locale,'location')} value={x.location||''} onChange={v=>setX({...x,location:v})}/><Field label={t(p.locale,'description')} value={x.description||''} onChange={v=>setX({...x,description:v})}/><View style={S.actions}><Pressable style={S.primary} onPress={()=>x.title.trim()&&p.onSave(x)}><Text style={S.primaryText}>{t(p.locale,'save')}</Text></Pressable><Pressable style={S.secondary} onPress={p.onClose}><Text style={S.secondaryText}>{t(p.locale,'cancel')}</Text></Pressable></View></View></View></Modal>; }

function GradeModal(p:{visible:boolean,initial?:Grade,locale:Locale,subjects:Subject[],onClose:()=>void,onSave:(x:Grade)=>void}) { const base=()=>({id:'',subjectId:p.subjects[0]?.id||'',type:'other' as GradeType,value:0,coefficient:1,date:new Date().toISOString().slice(0,10)});const [x,setX]=useState<Grade>(p.initial||base());useEffect(()=>setX(p.initial||base()),[p.initial,p.visible,p.subjects]);return <Modal visible={p.visible} transparent animationType="slide"><View style={S.modal}><View style={S.sheet}><Text style={S.title}>{p.initial?t(p.locale,'edit'):t(p.locale,'add')}</Text><Field label={t(p.locale,'value')} value={String(x.value)} onChange={v=>setX({...x,value:Math.min(20,Math.max(0,Number(v)||0))})}/><Field label={t(p.locale,'coefficient')} value={String(x.coefficient)} onChange={v=>setX({...x,coefficient:Math.max(0.01,Number(v)||1)})}/><Field label={t(p.locale,'date')} value={x.date} onChange={v=>setX({...x,date:v})}/><View style={S.actions}><Pressable style={S.primary} onPress={()=>x.subjectId&&p.onSave(x)}><Text style={S.primaryText}>{t(p.locale,'save')}</Text></Pressable><Pressable style={S.secondary} onPress={p.onClose}><Text style={S.secondaryText}>{t(p.locale,'cancel')}</Text></Pressable></View></View></View></Modal>; }

export default function App() { return <SQLiteProvider databaseName="student-planner.db" onInit={initDb}><AppContent/></SQLiteProvider>; }

const S=StyleSheet.create({root:{flex:1,backgroundColor:'#F6F7FB'},header:{paddingHorizontal:20,paddingTop:14,paddingBottom:8,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},logo:{fontSize:22,fontWeight:'800'},content:{padding:20,paddingBottom:110},title:{fontSize:28,fontWeight:'800',marginBottom:6},subtitle:{fontSize:15,color:'#667085',marginBottom:16},section:{fontSize:18,fontWeight:'800',marginTop:18,marginBottom:10},muted:{color:'#667085',marginTop:4},card:{backgroundColor:'#FFF',borderRadius:16,padding:15,marginBottom:10,elevation:1},cardTitle:{fontSize:16,fontWeight:'700'},row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},actions:{gap:8,marginVertical:8},primary:{backgroundColor:'#111827',padding:13,borderRadius:12,alignItems:'center'},secondary:{backgroundColor:'#E5E7EB',padding:13,borderRadius:12,alignItems:'center'},primaryText:{color:'#FFF',fontWeight:'700'},secondaryText:{color:'#111827',fontWeight:'700'},primarySmall:{backgroundColor:'#111827',paddingHorizontal:12,paddingVertical:9,borderRadius:10},tabs:{position:'absolute',bottom:0,left:0,right:0,backgroundColor:'#FFF',flexDirection:'row',borderTopWidth:1,borderTopColor:'#E5E7EB'},tab:{flex:1,paddingVertical:15,alignItems:'center'},tabText:{fontSize:12,color:'#667085'},active:{color:'#111827',fontWeight:'800'},badge:{fontSize:11,fontWeight:'700',color:'#475467',maxWidth:130,textAlign:'right'},stepper:{flexDirection:'row',alignItems:'center',gap:10},circle:{width:34,height:34,borderRadius:17,backgroundColor:'#E5E7EB',alignItems:'center',justifyContent:'center'},qty:{fontWeight:'800'},inlineActions:{flexDirection:'row',gap:18,marginTop:10},link:{fontWeight:'700',color:'#2563EB'},danger:{fontWeight:'700',color:'#DC2626'},strike:{textDecorationLine:'line-through'},field:{marginBottom:10},label:{fontSize:12,fontWeight:'700',marginBottom:5,color:'#475467'},input:{borderWidth:1,borderColor:'#D0D5DD',borderRadius:10,paddingHorizontal:11,paddingVertical:9,backgroundColor:'#FFF'},modal:{flex:1,backgroundColor:'rgba(0,0,0,.35)',justifyContent:'flex-end'},sheet:{backgroundColor:'#F8FAFC',padding:20,borderTopLeftRadius:20,borderTopRightRadius:20,maxHeight:'90%'}});
