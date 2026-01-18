import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { Stack, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { Belts, Students } from '../type/database';

const ITEMS_PER_PAGE = 6;

export default function DashboardAlunos() {
  const router = useRouter();
  const [alunos, setAlunos] = useState<Students[]>([]);
  const [loading, setLoading] = useState(true);
  const [belts, setBelts] = useState<Belts[]>([]);
  const [dojoId, setDojoId] = useState<string | null>(null);

  // Estados de Interface
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const isMobile = screenWidth < 768;
  const [menuOpen, setMenuOpen] = useState(false);

  // Filtros e Paginação
  const [selectedBelt, setSelectedBelt] = useState('TODAS');
  const [currentPage, setCurrentPage] = useState(1);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Função para formatar a data automaticamente (00/00/0000)
  const formatDate = (text: string) => {
    return text
      .replace(/\D/g, '') 
      .replace(/(\d{2})(\d)/, '$1/$2') 
      .replace(/(\d{2})(\d)/, '$1/$2') 
      .substring(0, 10); 
  };

  const [newStudent, setNewStudent] = useState({
    name: '', belt: '', birth_date: '', city: '', address: '', state: '', cpf: '', email: ''
  });

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setScreenWidth(window.width));
    return () => sub?.remove();
  }, []);

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { if (dojoId) fetchBelts(); }, [dojoId]);

  async function fetchData() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.replace('/login');

      const { data: dojo } = await supabase.from('dojo_users').select('dojo_id').eq('user_id', user.id).maybeSingle();

      if (dojo) {
        setDojoId(dojo.dojo_id);
        const { data } = await supabase.from('students').select('*').eq('dojo_id', dojo.dojo_id).order('name');
        setAlunos(data || []);
      }
    } catch (e: any) { Alert.alert('Erro', e.message); }
    finally { setLoading(false); }
  }

  async function fetchBelts() {
    const { data } = await supabase.from('belts').select('*').eq('dojo_id', dojoId).order('color');
    setBelts(data || []);
  }

  const filteredAlunos = selectedBelt === 'TODAS' ? alunos : alunos.filter(a => a.belt === selectedBelt);
  const totalPages = Math.ceil(filteredAlunos.length / ITEMS_PER_PAGE);
  const paginatedAlunos = filteredAlunos.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  async function handleCreateStudent() {
    if (!newStudent.name || !newStudent.belt || !newStudent.cpf) return Alert.alert("Atenção", "Preencha Nome, Faixa e CPF.");
    try {
      const { error } = await supabase.from('students').insert([{ ...newStudent, dojo_id: dojoId }]);
      if (error) throw error;
      Alert.alert("Sucesso", "Aluno cadastrado!");
      setIsCreateModalOpen(false);
      setNewStudent({ name: '', belt: '', birth_date: '', city: '', address: '', state: '', cpf: '', email: '' });
      fetchData();
    } catch (e: any) { Alert.alert("Erro", e.message); }
  }

  const handleLogout = async () => { await supabase.auth.signOut(); router.replace('/login'); };

  const MenuItem = ({ icon, title, active = false, onPress }: any) => (
    <TouchableOpacity style={[styles.menuItem, active && styles.menuItemActive]} onPress={onPress}>
      <Ionicons name={icon} size={20} color="#fff" />
      <Text style={styles.menuText}>{title}</Text>
    </TouchableOpacity>
  );

  return (
    <>
      <Head><title>Dashboard | Budo</title></Head>
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />

        {(!isMobile || menuOpen) && (
          <View style={[styles.sidebar, isMobile ? styles.sidebarMobile : styles.sidebarWeb]}>
            <View style={styles.logoContainer}><Image source={require('../assets/images/kimono.png')} style={styles.logoSidebar} /></View>
            <ScrollView>
              <MenuItem icon="people" title="Lista de Alunos" active={true} />
              <MenuItem icon="person-add" title="Cadastrar Alunos" onPress={() => { setIsCreateModalOpen(true); if (isMobile) setMenuOpen(false); }} />
              <MenuItem icon="settings" title="Cadastro de faixas" />
            </ScrollView>
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}><Ionicons name="arrow-back" size={20} color="#fff" /><Text style={styles.menuText}>Sair</Text></TouchableOpacity>
          </View>
        )}

        {isMobile && menuOpen && <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setMenuOpen(false)} />}

        <View style={styles.mainContent}>
          {isMobile ? (
            <View style={styles.mobileHeader}>
              <TouchableOpacity onPress={() => setMenuOpen(true)}><Ionicons name="menu" size={32} color="#222" /></TouchableOpacity>
              <Text style={styles.headerTitleMobile}>Alunos</Text>
            </View>
          ) : <Text style={styles.headerTitleWeb}>Gerenciamento de Alunos</Text>}

          <View style={styles.filterContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {['TODAS', ...belts.map(b => b.color)].map(belt => (
                <TouchableOpacity key={belt} onPress={() => { setSelectedBelt(belt); setCurrentPage(1); }} style={[styles.chip, selectedBelt === belt && styles.chipActive]}>
                  <Text style={[styles.chipText, selectedBelt === belt && styles.chipTextActive]}>{belt}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {loading ? <ActivityIndicator size="large" color="#b31d1d" style={{ flex: 1 }} /> : (
            <>
              {isMobile ? (
                <FlatList data={paginatedAlunos} keyExtractor={item => item.id} renderItem={({ item }) => (
                  <View style={styles.mobileCard}>
                    <View style={styles.avatar}><Text style={styles.avatarText}>{item.name.charAt(0)}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.mobileName}>{item.name}</Text>
                      <Text style={styles.mobileSub}>{item.belt} • {item.birth_date}</Text>
                    </View>
                    {/* BOTÕES RESTAURADOS NO MOBILE */}
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity style={styles.btnIcon}><Ionicons name="pencil" size={18} color="#5bc0de" /></TouchableOpacity>
                        <TouchableOpacity style={styles.btnIcon}><Ionicons name="trash" size={18} color="#d9534f" /></TouchableOpacity>
                    </View>
                  </View>
                )} />
              ) : (
                <View style={styles.webCard}>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.col, { flex: 2 }]}>Nome do Aluno</Text>
                    <Text style={[styles.col, { flex: 1 }]}>Nascimento</Text>
                    <Text style={[styles.col, { flex: 1, textAlign: 'center' }]}>Faixa</Text>
                    <Text style={[styles.col, { flex: 1, textAlign: 'center' }]}>Ações</Text>
                  </View>
                  <FlatList data={paginatedAlunos} keyExtractor={item => item.id} renderItem={({ item }) => (
                    <View style={styles.tableRow}>
                      <Text style={[styles.cell, { flex: 2 }]}>{item.name}</Text>
                      <Text style={[styles.cell, { flex: 1 }]}>{item.birth_date}</Text>
                      <Text style={[styles.cell, { flex: 1, textAlign: 'center', fontWeight: 'bold' }]}>{item.belt}</Text>
                      <View style={[styles.cell, { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 10 }]}>
                        <TouchableOpacity style={styles.btnIcon}><Ionicons name="pencil" size={18} color="#5bc0de" /></TouchableOpacity>
                        <TouchableOpacity style={styles.btnIcon}><Ionicons name="trash" size={18} color="#d9534f" /></TouchableOpacity>
                      </View>
                    </View>
                  )} />
                </View>
              )}
            </>
          )}
        </View>

        <Modal visible={isCreateModalOpen} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Cadastrar Novo Aluno</Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.label}>Nome do Aluno</Text>
                <TextInput style={styles.input} value={newStudent.name} onChangeText={(text) => setNewStudent({ ...newStudent, name: text })} />

                <Text style={styles.label}>Email</Text>
                <TextInput style={styles.input} value={newStudent.email} onChangeText={(text) => setNewStudent({ ...newStudent, email: text })} />

                <Text style={styles.label}>CPF</Text>
                <TextInput style={styles.input} value={newStudent.cpf} onChangeText={(text) => setNewStudent({ ...newStudent, cpf: text })} keyboardType="numeric" />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Nascimento</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="DD/MM/AAAA"
                      value={newStudent.birth_date}
                      onChangeText={(t) => setNewStudent({ ...newStudent, birth_date: formatDate(t) })}
                      keyboardType="numeric"
                      maxLength={10}
                    />
                  </View>
                  <View style={{ flex: 1 }}><Text style={styles.label}>Cidade</Text><TextInput style={styles.input} value={newStudent.city} onChangeText={(text) => setNewStudent({ ...newStudent, city: text })} /></View>
                </View>

                <Text style={styles.label}>Endereço</Text>
                <TextInput style={styles.input} value={newStudent.address} onChangeText={(text) => setNewStudent({ ...newStudent, address: text })} />

                <Text style={styles.label}>Faixa</Text>
                <View style={styles.pickerWrap}>
                  <Picker selectedValue={newStudent.belt} onValueChange={(v) => setNewStudent({ ...newStudent, belt: v })}>
                    <Picker.Item label="Selecione..." value="" />
                    {belts.map(b => <Picker.Item key={b.color} label={b.color} value={b.color} />)}
                  </Picker>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.btnCancel} onPress={() => setIsCreateModalOpen(false)}><Text>Cancelar</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.btnSave} onPress={handleCreateStudent}><Text style={{ color: '#fff', fontWeight: 'bold' }}>Salvar Aluno</Text></TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', backgroundColor: '#F4F7FE' },
  sidebar: { backgroundColor: '#1B1E23', paddingVertical: 20, width: 260 },
  sidebarMobile: { position: 'absolute', left: 0, zIndex: 100, height: '100%' },
  sidebarWeb: { },
  logoContainer: { alignItems: 'center', marginBottom: 30 },
  logoSidebar: { width: 70, height: 70, borderRadius: 35, borderWidth: 2, borderColor: '#b31d1d' },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 15, marginHorizontal: 10, borderRadius: 10, marginBottom: 5 },
  menuItemActive: { backgroundColor: '#b31d1d' },
  menuText: { color: '#fff', marginLeft: 12, fontWeight: '500' },
  logoutBtn: { flexDirection: 'row', padding: 20, marginTop: 'auto', borderTopWidth: 1, borderTopColor: '#333' },
  mainContent: { flex: 1, padding: 25 },
  headerTitleWeb: { fontSize: 28, fontWeight: 'bold', color: '#1B2559', marginBottom: 25 },
  headerTitleMobile: { fontSize: 20, fontWeight: 'bold', marginLeft: 15 },
  mobileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingTop: 30 },
  filterContainer: { marginBottom: 25 },
  chip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: '#fff', elevation: 2 },
  chipActive: { backgroundColor: '#b31d1d' },
  chipText: { color: '#A3AED0', fontWeight: 'bold' },
  chipTextActive: { color: '#fff' },
  webCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, elevation: 3 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#F4F7FE', paddingBottom: 15, marginBottom: 10 },
  col: { color: '#A3AED0', fontWeight: '600', fontSize: 13, textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', paddingVertical: 15, borderBottomWidth: 1, borderColor: '#F4F7FE', alignItems: 'center' },
  cell: { color: '#2B3674', fontSize: 15, fontWeight: '500' },
  btnIcon: { padding: 8, borderRadius: 8, backgroundColor: '#F4F7FE' },
  mobileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 15, marginBottom: 12 },
  avatar: { width: 45, height: 45, borderRadius: 12, backgroundColor: '#F4F7FE', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  avatarText: { color: '#b31d1d', fontWeight: 'bold', fontSize: 18 },
  mobileName: { fontWeight: 'bold', fontSize: 16, color: '#2B3674' },
  mobileSub: { color: '#A3AED0', fontSize: 12, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '90%', maxWidth: 500, backgroundColor: '#fff', borderRadius: 24, padding: 25, maxHeight: '85%' },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#1B2559', marginBottom: 20, textAlign: 'center' },
  label: { fontSize: 14, fontWeight: '700', color: '#1B2559', marginTop: 15, marginBottom: 5 },
  input: { backgroundColor: '#F4F7FE', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E0E5F2' },
  pickerWrap: { backgroundColor: '#F4F7FE', borderRadius: 12, borderWidth: 1, borderColor: '#E0E5F2', marginTop: 5 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 30 },
  btnCancel: { padding: 15, borderRadius: 12, backgroundColor: '#F4F7FE' },
  btnSave: { padding: 15, borderRadius: 12, backgroundColor: '#b31d1d' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 90 },
});