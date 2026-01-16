import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { Stack, useRouter } from 'expo-router';
import Head from 'expo-router/head'; // Importação importante
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

export default function DashboardAlunos() {
  const router = useRouter();
  const [alunos, setAlunos] = useState<Students[]>([]);
  const [loading, setLoading] = useState(true);
  const [belts, setBelts] = useState<Belts[]>([]);
  const [dojoId, setDojoId] = useState<string | null>(null);

  // Controle de Responsividade
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const isMobile = screenWidth < 768;
  const [menuOpen, setMenuOpen] = useState(false);

  // Estado para o Dropdown/Modal Mobile
  const [selectedStudent, setSelectedStudent] = useState<Students | null>(null);

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(window.width);
    });
    return () => subscription?.remove();
  }, []);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newStudent, setNewStudent] = useState({
    name: '',
    belt: '',
    birth_date: '',
    city: '',
    address: '',
    state: '',
    cpf: '',
    email: ''
  });

  async function fetchDojo() {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/login');
        return null;
      }

      const { data, error } = await supabase
        .from('dojos_users')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setDojoId(data.id);
        return data.id; // Retorna para uso imediato se necessário
      } else {
        console.warn("Nenhum dojo cadastrado para este professor.");
        return null;
      }
    } catch (error) {
      console.error("Erro ao buscar Dojo:", error);
      return null;
    }
  }


  async function fetchBelts() {
    try {
      const { data, error } = await supabase
        .from('belts')
        .select('color')
        .eq('dojo_id', dojoId)
        .order('color', { ascending: true });

      if (error) throw error;

      if (data) {
        // O TypeScript agora entenderá que data possui id e name
        setBelts(data as Belts[]);
      }
    } catch (error) {
      console.error('Erro ao carregar faixas:', error);
    }
  }

  useEffect(() => {
    fetchData();
    fetchBelts(); // Carrega as faixas ao iniciar
  }, []);

  async function handleCreateStudent() {
    // Validação básica de campos obrigatórios
    if (!newStudent.name || !newStudent.belt || !newStudent.cpf) {
      Alert.alert("Atenção", "Por favor, preencha pelo menos Nome, Faixa e CPF.");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Busca o Dojo vinculado ao professor logado
      const { data: dojo } = await supabase
        .from('dojo_users')
        .select('dojo_id')
        .eq('user_id', user?.id)
        .single();

      if (!dojo) {
        Alert.alert("Erro", "Dojo não encontrado para este usuário.");
        return;
      }

      // Insere no banco com todos os campos da interface
      const { error } = await supabase.from('students').insert([
        {
          name: newStudent.name,
          belt: newStudent.belt,
          birth_date: newStudent.birth_date,
          city: newStudent.city,
          address: newStudent.address,
          state: newStudent.state,
          cpf: newStudent.cpf,
          email: newStudent.email,
          dojo_id: dojo.dojo_id
        }
      ]);

      if (error) throw error;

      Alert.alert("Sucesso", "Aluno cadastrado com sucesso!");
      setIsCreateModalOpen(false);

      // Reset do formulário com todos os campos novos
      setNewStudent({
        name: '', belt: '', birth_date: '', city: '',
        address: '', state: '', cpf: '', email: ''
      });

      fetchData(); // Atualiza a lista na tela principal
    } catch (error: any) {
      console.error(error);
      Alert.alert("Erro ao salvar", error.message || "Não foi possível cadastrar o aluno.");
    }
  }

  async function fetchData() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.replace('/login');

      // Busca o dojo do professor
      const { data: dojo, error: dojoError } = await supabase
        .from('dojo_users')
        .select('dojo_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (dojoError) throw dojoError;

      if (dojo) {
        setDojoId(dojo.id);
        const { data: students, error: studentsError } = await supabase
          .from('students')
          .select('*')
          .eq('dojo_id', dojo.dojo_id)
          .order('name', { ascending: true });

        if (studentsError) throw studentsError;
        setAlunos(students || []);
      }
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Falha ao carregar dados');
    } finally {
      setLoading(false);
    }
  }

  // Substitua seus useEffects por estes dois:

  useEffect(() => {
    fetchData();
  }, []);

  // Este novo useEffect garante que as faixas carreguem assim que o dojoId for definido
  useEffect(() => {
    if (dojoId) {
      fetchBelts();
    }
  }, [dojoId]);
  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  // Itens do Menu Lateral
  // Dentro do DashboardAlunos
  const MenuItem = ({ icon, title, active = false, onPress }: any) => (
    <TouchableOpacity
      style={[styles.menuItem, active && styles.menuItemActive]}
      onPress={onPress} // <-- Esta linha é essencial!
    >
      <Ionicons name={icon} size={20} color="#fff" />
      <Text style={styles.menuText}>{title}</Text>
    </TouchableOpacity>
  );

  // --- COMPONENTES DE RENDERIZAÇÃO ---
  // Versão Mobile: Card com Design Minimalista e Badge
  const MobileCard = ({ item }: { item: Students }) => (
    <View style={styles.mobileCard}>
      <View style={styles.mobileCardLeft}>
        {/* Círculo do Avatar (pode usar imagem ou iniciais) */}
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
        </View>

        <View style={styles.mobileInfoContainer}>
          <Text style={styles.mobileName} numberOfLines={1}>{item.name}</Text>
          <View style={styles.badgeContainer}>
            <View style={[styles.beltBadge, { backgroundColor: '#f0f0f0' }]}>
              <Text style={styles.mobileSub}>{item.belt}</Text>
            </View>
            <Text style={styles.birthDateText}>{item.birth_date}</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={styles.moreButton}
        onPress={() => setSelectedStudent(item)}
      >
        <Ionicons name="ellipsis-vertical" size={20} color="#999" />
      </TouchableOpacity>
    </View>
  );

  // Versão Web: Linha da Tabela (Fonte maior e centralizada)
  const TableRow = ({ item }: { item: Students }) => (
    <View style={styles.tableRow}>
      <Text style={[styles.cell, { width: 350 }]}>{item.name}</Text>
      <Text style={styles.mobileName}>{item.birth_date}</Text>
      <Text style={[styles.cell, { width: 150, fontWeight: 'bold', textAlign: 'center' }]}>{item.belt}</Text>
      <View style={styles.actionContainerWeb}>
        <TouchableOpacity style={styles.btnEditWeb}><Text style={styles.btnTextWeb}>Editar</Text></TouchableOpacity>
        <TouchableOpacity style={styles.btnDelWeb}><Text style={styles.btnTextWeb}>Excluir</Text></TouchableOpacity>
      </View>
    </View>
  );

  return (
    <>
      <Head>
        <title>Dashboard | Budo</title>
        <meta name="description" content="Página de Login" />
      </Head>

      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />

        {/* 1. SIDEBAR */}
        {(!isMobile || menuOpen) && (
          <View style={[styles.sidebar, isMobile ? styles.sidebarMobile : styles.sidebarWeb]}>
            <View style={styles.logoContainer}>
              <Image source={require('../assets/images/kimono.png')} style={styles.logoSidebar} />
            </View>
            <ScrollView>
              <MenuItem icon="people" title="Lista de Alunos" active={true} />
              <MenuItem
                icon="person-add"
                title="Cadastrar Alunos"
                onPress={() => {
                  setIsCreateModalOpen(true);
                  if (isMobile) setMenuOpen(false); // Fecha o menu lateral no mobile
                }}
              />
              <MenuItem icon="pencil" title="Cadastrar Dojo" />
              <MenuItem icon="settings" title="Cadastro de faixas" />
              {/*<MenuItem icon="calendar" title="Calendário de eventos" />
              <MenuItem icon="cash" title="Mensalidade" />*/}
            </ScrollView>
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
              <Text style={styles.menuText}>Sair</Text>
            </TouchableOpacity>
          </View>
        )}

        {isMobile && menuOpen && (
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setMenuOpen(false)} />
        )}

        {/* 2. CONTEÚDO PRINCIPAL */}
        <View style={styles.mainContent}>
          {isMobile && (
            <View style={styles.mobileHeader}>
              <TouchableOpacity onPress={() => setMenuOpen(true)}>
                <Ionicons name="menu" size={32} color="#222" />
              </TouchableOpacity>
              <Text style={styles.headerTitleMobile}>Lista de Alunos</Text>
            </View>
          )}

          {!isMobile && <Text style={styles.headerTitleWeb}>Lista de Alunos</Text>}

          {loading ? (
            <ActivityIndicator size="large" color="#b31d1d" style={{ flex: 1 }} />
          ) : (
            isMobile ? (
              <FlatList
                data={alunos}
                keyExtractor={item => item.id}
                renderItem={({ item }) => <MobileCard item={item} />}
                contentContainerStyle={{ paddingBottom: 20 }}
                ListEmptyComponent={<Text style={styles.emptyText}>Nenhum aluno encontrado.</Text>}
              />
            ) : (
              <View style={styles.webTableWrapper}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.columnHeader, { width: 350 }]}>NOME DO ALUNO</Text>
                  <Text style={[styles.columnHeader, { width: 350 }]}>DATA DE NASCIMENTO</Text>
                  <Text style={[styles.columnHeader, { width: 150, textAlign: 'center' }]}>FAIXA</Text>
                  <Text style={[styles.columnHeader, { width: 200, textAlign: 'center' }]}>AÇÕES</Text>
                </View>
                <FlatList
                  data={alunos}
                  keyExtractor={item => item.id}
                  renderItem={({ item }) => <TableRow item={item} />}
                  ListEmptyComponent={<Text style={styles.emptyText}>Nenhum aluno cadastrado.</Text>}
                />
              </View>
            )
          )}
        </View>

        {/* 3. DROPDOWN MODAL (MOBILE) */}
        <Modal visible={!!selectedStudent} transparent animationType="fade">
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setSelectedStudent(null)}
          >
            <View style={styles.dropdownContainer}>
              <Text style={styles.dropdownTitle}>{selectedStudent?.name}</Text>
              <TouchableOpacity style={styles.dropdownItem} onPress={() => setSelectedStudent(null)}>
                <Ionicons name="pencil" size={20} color="#5bc0de" />
                <Text style={styles.dropdownText}>Editar Aluno</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.dropdownItem, { borderBottomWidth: 0 }]} onPress={() => setSelectedStudent(null)}>
                <Ionicons name="trash" size={20} color="#d9534f" />
                <Text style={styles.dropdownText}>Excluir Aluno</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* MODAL PARA CRIAR ALUNO - CORRIGIDO */}
        <Modal visible={isCreateModalOpen} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.dropdownContainer, { width: isMobile ? '90%' : 500, padding: 20 }]}>
              <Text style={[styles.dropdownTitle, { fontSize: 22, borderBottomWidth: 0 }]}>Cadastrar Novo Aluno</Text>

              {/* Adicionado ScrollView para não cortar em telas menores */}
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.label}>Nome do Aluno</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Digite o nome completo"
                  value={newStudent.name}
                  onChangeText={(text) => setNewStudent({ ...newStudent, name: text })}
                />

                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Digite o email"
                  value={newStudent.email} // Corrigido de .name para .email
                  onChangeText={(text) => setNewStudent({ ...newStudent, email: text })}
                />

                <Text style={styles.label}>CPF</Text>
                <TextInput
                  style={styles.input}
                  placeholder="000.000.000-00"
                  value={newStudent.cpf}
                  onChangeText={(text) => setNewStudent({ ...newStudent, cpf: text })}
                  keyboardType="numeric"
                  maxLength={14}
                />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Nascimento</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="DD/MM/AAAA"
                      value={newStudent.birth_date}
                      onChangeText={(text) => setNewStudent({ ...newStudent, birth_date: text })}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Cidade</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Ex: Unaí"
                      value={newStudent.city}
                      onChangeText={(text) => setNewStudent({ ...newStudent, city: text })}
                    />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Estado</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Ex: MG"
                      value={newStudent.state}
                      onChangeText={(text) => setNewStudent({ ...newStudent, state: text })}
                    />
                  </View>
                </View>

                <Text style={styles.label}>Endereço</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Rua ..., 123"
                  value={newStudent.address} // Corrigido de .city para .address
                  onChangeText={(text) => setNewStudent({ ...newStudent, address: text })}
                />

                <Text style={styles.label}>Faixa</Text>
                <View style={[styles.input, { padding: 0, justifyContent: 'center' }]}>
                  <Picker
                    selectedValue={newStudent.belt}
                    onValueChange={(itemValue) =>
                      setNewStudent({ ...newStudent, belt: itemValue })
                    }
                    style={{ height: 50, width: '100%' }}
                  >
                    <Picker.Item label="Selecione uma faixa..." value="" color="#999" />
                    {belts.map((b) => (
                      <Picker.Item key={b.id} label={b.color} value={b.color} />
                    ))}
                  </Picker>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.btnAction, { backgroundColor: '#ccc' }]}
                    onPress={() => setIsCreateModalOpen(false)}
                  >
                    <Text style={styles.btnTextForm}>Cancelar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.btnAction, { backgroundColor: '#b31d1d' }]}
                    onPress={handleCreateStudent}
                  >
                    <Text style={styles.btnTextForm}>Salvar Aluno</Text>
                  </TouchableOpacity>
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
  container: { flex: 1, flexDirection: 'row', backgroundColor: '#f8f9fa' },

  // Sidebar
  sidebar: { backgroundColor: '#222', height: '100%' },
  sidebarWeb: { width: 250, borderRightWidth: 1, borderRightColor: '#111' },
  sidebarMobile: { position: 'absolute', left: 0, top: 0, zIndex: 100, width: 260, height: '100%', elevation: 10 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 90 },

  // Header & Menu
  logoContainer: { padding: 40, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#333' },
  logoSidebar: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: '#fff' },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#333' },
  menuItemActive: { backgroundColor: '#444' },
  menuText: { color: '#fff', marginLeft: 10, fontSize: 13 },
  logoutBtn: { flexDirection: 'row', padding: 20, backgroundColor: '#1a1a1a', alignItems: 'center', marginTop: 'auto' },

  // Conteúdo Principal
  mainContent: { flex: 1, padding: 20 },
  headerTitleWeb: { fontSize: 32, fontWeight: 'bold', marginBottom: 40, textAlign: 'center', color: '#1a1a1a' },
  headerTitleMobile: { fontSize: 22, fontWeight: 'bold', marginLeft: 15 },
  mobileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingTop: 40, borderBottomWidth: 1, borderColor: '#eee', paddingBottom: 15 },

  // Estilos Tabela Web (Centralizada e Grande)
  webTableWrapper: {
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: '#eee'
  },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f1f1f1', padding: 20, borderBottomWidth: 2, borderColor: '#e0e0e0' },
  columnHeader: { fontWeight: '800', fontSize: 16, color: '#555', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', padding: 20, borderBottomWidth: 1, borderColor: '#f0f0f0', alignItems: 'center' },
  cell: { fontSize: 18, color: '#333' },
  actionContainerWeb: { flexDirection: 'row', width: 200, justifyContent: 'center' },
  btnEditWeb: { backgroundColor: '#5bc0de', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 6, marginRight: 10 },
  btnDelWeb: { backgroundColor: '#d9534f', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 6 },
  btnTextWeb: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  // Estilos Mobile (Cards)
  mobileCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 18, borderRadius: 12, marginBottom: 12, elevation: 2, borderLeftWidth: 5, borderLeftColor: '#b31d1d' },
  mobileName: { fontSize: 18, fontWeight: 'bold', color: '#222' },
  mobileSub: { fontSize: 15, color: '#666', marginTop: 4 },

  // Estilos Dropdown Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  dropdownContainer: { width: '85%', backgroundColor: '#fff', borderRadius: 15, overflow: 'hidden' },
  dropdownTitle: { padding: 20, fontWeight: 'bold', fontSize: 18, borderBottomWidth: 1, borderColor: '#eee', textAlign: 'center', backgroundColor: '#fafafa' },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderColor: '#eee' },
  dropdownText: { marginLeft: 15, fontSize: 18, color: '#333' },
  emptyText: { padding: 40, textAlign: 'center', fontSize: 16, color: '#999' },

  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
    marginTop: 10
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9'
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 25
  },
  btnAction: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center'
  },
  btnTextForm: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16
  },
  // Estilos Mobile (Cards Renovados)
  mobileCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 16,
    marginBottom: 12,
    // Sombra suave para Mobile
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f0f0'
  },
  mobileCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  avatarCircle: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: '#b31d1d', // Cor principal do seu Dojo
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold'
  },
  mobileInfoContainer: {
    flex: 1
  },
  mobileName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a'
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8
  },
  beltBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd'
  },
  mobileSub: {
    fontSize: 12,
    color: '#444',
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  birthDateText: {
    fontSize: 12,
    color: '#999'
  },
  moreButton: {
    padding: 10,
    marginLeft: 5
  }
});