import Head from 'expo-router/head'; // Importação importante
import React from 'react';
import {
  Alert,
  StyleSheet
} from 'react-native';
import { supabase } from '../lib/supabase';
import { Belts } from '../type/database';

export default function DashboardAlunos() {
  return (
    <>
      <Head>
        <title>Budo</title>
        <meta name="description" content="Página inicial" />
      </Head>
      
      {/* Resto do seu código de Login */}
    </>
  );

  async function fetchDojo() {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/login');
        return null;
      }

      const { data, error } = await supabase
        .from('dojos')
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
        .from('dojos')
        .select('id')
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
          dojo_id: dojo.id
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
        .from('dojos')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (dojoError) throw dojoError;

      if (dojo) {
        setDojoId(dojo.id);
        const { data: students, error: studentsError } = await supabase
          .from('students')
          .select('*')
          .eq('dojo_id', dojo.id)
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

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

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
  }
});