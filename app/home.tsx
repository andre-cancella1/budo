import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
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

const ITEMS_PER_PAGE = 10;

export default function DashboardAlunos() {
  const [alunos, setAlunos] = useState<Students[]>([]);
  const [loading, setLoading] = useState(true);
  const [belts, setBelts] = useState<Belts[]>([]);
  const [dojoId, setDojoId] = useState<string | null>(null);

  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const isMobile = screenWidth < 768;

  const [selectedBelt, setSelectedBelt] = useState('TODAS');
  const [currentPage, setCurrentPage] = useState(1);

  // Modais
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isBeltModalOpen, setIsBeltModalOpen] = useState(false);

  const [newBeltColor, setNewBeltColor] = useState('');

  // FORMULÁRIO COMPLETO RESTAURADO
  const [newStudent, setNewStudent] = useState({
    name: '',
    belt: '',
    birth_date: '',
    city: '',
    address: '',
    state: '',
    cpf: '',
    email: '',
    guardian_name: '',
    phone: '',
    tuition_value: '150' // Campo para o financeiro
  });

  const formatDate = (text: string) => {
    return text.replace(/\D/g, '').replace(/(\d{2})(\d)/, '$1/$2').replace(/(\d{2})(\d)/, '$1/$2').substring(0, 10);
  };

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
      if (!user) return;
      const { data: dojo } = await supabase.from('dojo_users').select('dojo_id').eq('user_id', user.id).maybeSingle();
      if (dojo) {
        setDojoId(dojo.dojo_id);
        const { data } = await supabase.from('students').select('*').eq('dojo_id', dojo.dojo_id).order('name');
        setAlunos(data || []);
      }
    } catch (e: any) { Alert.alert('Erro', e.message); } finally { setLoading(false); }
  }

  async function fetchBelts() {
    const { data } = await supabase.from('belts').select('*').eq('dojo_id', dojoId).order('color');
    setBelts(data || []);
  }

  async function handleCreateStudent() {
    if (!newStudent.name || !newStudent.belt || !newStudent.cpf) {
      return Alert.alert("Atenção", "Preencha Nome, Faixa e CPF.");
    }

    try {
      setLoading(true);

      // SEPARA o tuition_value do resto dos dados do aluno
      const { tuition_value, ...studentDataToSave } = newStudent;

      // 1. Inserir Aluno apenas com os campos da tabela 'students'
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .insert([{ ...studentDataToSave, dojo_id: dojoId }])
        .select().single();

      if (studentError) throw studentError;

      // 2. Gerar Mensalidades usando o tuition_value extraído
      const mensalidades = [];
      const hoje = new Date();
      const valorMensalidade = parseFloat(tuition_value) || 0;

      for (let i = hoje.getMonth(); i <= 11; i++) {
        mensalidades.push({
          student_id: studentData.id,
          dojo_id: dojoId,
          description: `Mensalidade ${i + 1}/${hoje.getFullYear()}`,
          amount: valorMensalidade,
          due_date: new Date(hoje.getFullYear(), i, hoje.getDate()).toISOString().split('T')[0],
          status: 'PENDENTE'
        });
      }

      const { error: paymentError } = await supabase.from('payments').insert(mensalidades);
      if (paymentError) console.error("Erro ao gerar mensalidades:", paymentError);

      Alert.alert("Sucesso", "Aluno cadastrado e mensalidades geradas!");
      setIsCreateModalOpen(false);

      // Limpa o formulário
      setNewStudent({
        name: '', belt: '', birth_date: '', city: '', address: '', state: '',
        cpf: '', email: '', guardian_name: '', phone: '', tuition_value: '150'
      });

      fetchData();
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    } finally {
      setLoading(false);
    }
  }

  const filteredAlunos = selectedBelt === 'TODAS' ? alunos : alunos.filter(a => a.belt === selectedBelt);
  const paginatedAlunos = filteredAlunos.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <View style={styles.container}>
      <Head><title>Alunos | Budo</title></Head>
      <Stack.Screen options={{ title: 'Alunos' }} />

      <View style={styles.mainContent}>
        <View style={styles.headerRow}>
          <Text style={isMobile ? styles.headerTitleMobile : styles.headerTitleWeb}>Alunos</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={styles.btnSecondary} onPress={() => setIsBeltModalOpen(true)}>
              <Ionicons name="settings-outline" size={20} color="#1B2559" />
              {!isMobile && <Text style={styles.btnSecondaryText}>Faixas</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnNew} onPress={() => setIsCreateModalOpen(true)}>
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.btnNewText}>{isMobile ? 'Novo' : 'Novo Aluno'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* FILTROS */}
        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {['TODAS', ...belts.map(b => b.color)].map(belt => (
              <TouchableOpacity key={belt} onPress={() => { setSelectedBelt(belt); setCurrentPage(1); }}
                style={[styles.chip, selectedBelt === belt && styles.chipActive]}>
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
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity style={styles.btnIcon}><Ionicons name="pencil" size={18} color="#5bc0de" /></TouchableOpacity>
                    <TouchableOpacity style={styles.btnIcon}><Ionicons name="trash" size={18} color="#d9534f" /></TouchableOpacity>
                  </View>
                </View>
              )} />
            ) : (
              <View style={styles.webCard}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.col, { flex: 2 }]}>Nome</Text>
                  <Text style={[styles.col, { flex: 1 }]}>Nascimento</Text>
                  <Text style={[styles.col, { flex: 1, textAlign: 'center' }]}>Faixa</Text>
                  <Text style={[styles.col, { flex: 1, textAlign: 'center' }]}>Ações</Text>
                </View>
                <FlatList data={paginatedAlunos} keyExtractor={item => item.id} renderItem={({ item }) => (
                  <View style={styles.tableRow}>
                    <Text style={[styles.cell, { flex: 2 }]}>{item.name}</Text>
                    <Text style={[styles.cell, { flex: 1 }]}>{item.birth_date}</Text>
                    <Text style={[styles.cell, { flex: 1, textAlign: 'center', fontWeight: 'bold' }]}>{item.belt}</Text>
                    <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
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

      {/* MODAL ALUNO COMPLETO */}
      <Modal visible={isCreateModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cadastro de Aluno</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Nome Completo</Text>
              <TextInput style={styles.input} value={newStudent.name} onChangeText={(t) => setNewStudent({ ...newStudent, name: t })} />

              <View style={styles.row}>
                <View style={{ flex: 1 }}><Text style={styles.label}>CPF</Text>
                  <TextInput style={styles.input} value={newStudent.cpf} onChangeText={(t) => setNewStudent({ ...newStudent, cpf: t })} keyboardType="numeric" />
                </View>
                <View style={{ flex: 1 }}><Text style={styles.label}>Nascimento</Text>
                  <TextInput style={styles.input} value={newStudent.birth_date} onChangeText={(t) => setNewStudent({ ...newStudent, birth_date: formatDate(t) })} maxLength={10} />
                </View>
              </View>

              <Text style={styles.label}>E-mail</Text>
              <TextInput style={styles.input} value={newStudent.email} onChangeText={(t) => setNewStudent({ ...newStudent, email: t })} keyboardType="email-address" />

              <View style={styles.row}>
                <View style={{ flex: 1 }}><Text style={styles.label}>Telefone</Text>
                  <TextInput style={styles.input} value={newStudent.phone} onChangeText={(t) => setNewStudent({ ...newStudent, phone: t })} keyboardType="phone-pad" />
                </View>
                <View style={{ flex: 1 }}><Text style={styles.label}>Valor Mensalidade</Text>
                  <TextInput style={styles.input} value={newStudent.tuition_value} onChangeText={(t) => setNewStudent({ ...newStudent, tuition_value: t })} keyboardType="numeric" />
                </View>
              </View>

              <Text style={styles.label}>Responsável (Obrigatório para menores)</Text>
              <TextInput style={styles.input} value={newStudent.guardian_name} onChangeText={(t) => setNewStudent({ ...newStudent, guardian_name: t })} />

              <Text style={styles.label}>Endereço</Text>
              <TextInput style={styles.input} value={newStudent.address} onChangeText={(t) => setNewStudent({ ...newStudent, address: t })} />

              <View style={styles.row}>
                <View style={{ flex: 2 }}><Text style={styles.label}>Cidade</Text>
                  <TextInput style={styles.input} value={newStudent.city} onChangeText={(t) => setNewStudent({ ...newStudent, city: t })} />
                </View>
                <View style={{ flex: 1 }}><Text style={styles.label}>Estado</Text>
                  <TextInput style={styles.input} value={newStudent.state} onChangeText={(t) => setNewStudent({ ...newStudent, state: t })} maxLength={2} autoCapitalize="characters" />
                </View>
              </View>

              <Text style={styles.label}>Faixa Atual</Text>
              <View style={styles.pickerWrap}>
                <Picker selectedValue={newStudent.belt} onValueChange={(v) => setNewStudent({ ...newStudent, belt: v })}>
                  <Picker.Item label="Selecione..." value="" />
                  {belts.map(b => <Picker.Item key={b.color} label={b.color} value={b.color} />)}
                </Picker>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.btnCancel} onPress={() => setIsCreateModalOpen(false)}><Text>Sair</Text></TouchableOpacity>
                <TouchableOpacity style={styles.btnSave} onPress={handleCreateStudent}><Text style={{ color: '#fff', fontWeight: 'bold' }}>Salvar Aluno</Text></TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL FAIXAS (RESTAURADO) */}
      <Modal visible={isBeltModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Faixas</Text>
              <TouchableOpacity onPress={() => setIsBeltModalOpen(false)}><Ionicons name="close" size={24} /></TouchableOpacity>
            </View>
            <View style={styles.inputRow}>
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="Nova cor" value={newBeltColor} onChangeText={setNewBeltColor} />
              <TouchableOpacity style={styles.btnAddSmall} onPress={async () => {
                const { error } = await supabase.from('belts').insert([{ color: newBeltColor.toUpperCase(), dojo_id: dojoId }]);
                if (!error) { setNewBeltColor(''); fetchBelts(); }
              }}><Ionicons name="add" size={24} color="#fff" /></TouchableOpacity>
            </View>
            <FlatList data={belts} keyExtractor={item => item.id} style={{ maxHeight: 200 }} renderItem={({ item }) => (
              <View style={styles.beltListItem}>
                <Text style={{ fontWeight: 'bold' }}>{item.color}</Text>
                <TouchableOpacity onPress={async () => { await supabase.from('belts').delete().eq('id', item.id); fetchBelts(); }}>
                  <Ionicons name="trash-outline" size={20} color="#d9534f" />
                </TouchableOpacity>
              </View>
            )} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FE' },
  mainContent: { flex: 1, padding: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitleWeb: { fontSize: 26, fontWeight: 'bold', color: '#1B2559' },
  headerTitleMobile: { fontSize: 22, fontWeight: 'bold', color: '#1B2559' },
  btnNew: { backgroundColor: '#b31d1d', flexDirection: 'row', padding: 12, borderRadius: 12, alignItems: 'center', gap: 5 },
  btnNewText: { color: '#fff', fontWeight: 'bold' },
  btnSecondary: { backgroundColor: '#fff', flexDirection: 'row', padding: 12, borderRadius: 12, alignItems: 'center', gap: 5, borderWidth: 1, borderColor: '#E0E5F2' },
  btnSecondaryText: { color: '#1B2559', fontWeight: 'bold' },
  filterContainer: { marginBottom: 20 },
  chip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 10, backgroundColor: '#fff', marginRight: 8 },
  chipActive: { backgroundColor: '#b31d1d' },
  chipText: { color: '#A3AED0', fontWeight: 'bold' },
  chipTextActive: { color: '#fff' },
  webCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#F4F7FE', paddingBottom: 15, marginBottom: 10 },
  col: { color: '#A3AED0', fontWeight: '600', fontSize: 13, textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', paddingVertical: 15, borderBottomWidth: 1, borderColor: '#F4F7FE', alignItems: 'center' },
  cell: { color: '#2B3674', fontSize: 15 },
  mobileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 15, marginBottom: 10 },
  avatar: { width: 45, height: 45, borderRadius: 12, backgroundColor: '#F4F7FE', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  avatarText: { color: '#b31d1d', fontWeight: 'bold' },
  mobileName: { fontWeight: 'bold', fontSize: 16, color: '#2B3674' },
  mobileSub: { color: '#A3AED0', fontSize: 12 },
  btnIcon: { padding: 8, borderRadius: 8, backgroundColor: '#F4F7FE' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '90%', maxWidth: 550, backgroundColor: '#fff', borderRadius: 25, padding: 25, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#1B2559' },
  label: { fontWeight: '600', color: '#1B2559', marginTop: 15, marginBottom: 5 },
  input: { backgroundColor: '#F4F7FE', padding: 12, borderRadius: 12, color: '#2B3674' },
  row: { flexDirection: 'row', gap: 10 },
  inputRow: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  btnAddSmall: { backgroundColor: '#b31d1d', padding: 12, borderRadius: 12, justifyContent: 'center' },
  beltListItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderColor: '#F4F7FE' },
  pickerWrap: { backgroundColor: '#F4F7FE', borderRadius: 12, marginTop: 5 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 15, marginTop: 30 },
  btnCancel: { padding: 12 },
  btnSave: { backgroundColor: '#b31d1d', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 12 }
});