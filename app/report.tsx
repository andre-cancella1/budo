import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import * as FileSystem from 'expo-file-system';
import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';

type ReportType = 'ALUNOS' | 'FINANCEIRO';
type FinanceStatusFilter = 'TODOS' | 'PENDENTE' | 'PAGO';

export default function DashboardRelatorios() {
  const [loading, setLoading] = useState(false);
  const [dojoId, setDojoId] = useState<string | null>(null);
  
  // Estados dos Filtros
  const [reportType, setReportType] = useState<ReportType>('ALUNOS');
  const [statusFilter, setStatusFilter] = useState<FinanceStatusFilter>('TODOS');

  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const isMobile = screenWidth < 768;

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setScreenWidth(window.width));
    return () => sub?.remove();
  }, []);

  useEffect(() => {
    async function getDojo() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: dojo } = await supabase.from('dojo_users').select('dojo_id').eq('user_id', user.id).maybeSingle();
        if (dojo) setDojoId(dojo.dojo_id);
      } catch (e: any) {
        console.error(e.message);
      }
    }
    getDojo();
  }, []);

  // FUNÇÃO PRINCIPAL: GERAÇÃO E EXPORTAÇÃO DO EXCEL
  async function generateExcelReport() {
    if (!dojoId) {
      const msg = "Dojo não identificado. Verifique sua conexão.";
      Platform.OS === 'web' ? alert(msg) : Alert.alert("Erro", msg);
      return;
    }

    try {
      setLoading(true);

      let dataToExport: any[] = [];
      let filename = `Relatorio_${reportType.toLowerCase()}_${new Date().toISOString().split('T')[0]}`;

      if (reportType === 'ALUNOS') {
        // Busca completa de alunos e suas informações cadastrais
        const { data: students, error } = await supabase
          .from('students')
          .select('name, belt, birth_date, cpf, email, phone, guardian_name, city, state, address')
          .eq('dojo_id', dojoId)
          .order('name');

        if (error) throw error;

        if (!students || students.length === 0) {
          const msg = "Nenhum aluno encontrado para gerar o relatório.";
          Platform.OS === 'web' ? alert(msg) : Alert.alert("Aviso", msg);
          return;
        }

        // Mapeia para colunas amigáveis em português
        dataToExport = students.map(student => ({
          'Nome Completo': student.name || '',
          'Graduação / Faixa': student.belt || '',
          'Data de Nascimento': student.birth_date || '',
          'CPF': student.cpf || '',
          'E-mail': student.email || '',
          'Telefone contato': student.phone || '',
          'Responsável Legal': student.guardian_name || '',
          'Cidade': student.city || '',
          'Estado': student.state || '',
          'Endereço Residencial': student.address || ''
        }));

      } else {
        // Relatório Financeiro: Junção de dados de pagamentos com o nome do aluno
        let query = supabase
          .from('payments')
          .select(`
            amount,
            description,
            due_date,
            status,
            students ( name )
          `)
          .eq('dojo_id', dojoId)
          .order('due_date', { ascending: true });

        // Aplica o filtro de status caso não seja 'TODOS'
        if (statusFilter !== 'TODOS') {
          query = query.eq('status', statusFilter);
        }

        const { data: payments, error } = await query;
        if (error) throw error;

        if (!payments || payments.length === 0) {
          const msg = "Nenhum registro financeiro encontrado com os filtros selecionados.";
          Platform.OS === 'web' ? alert(msg) : Alert.alert("Aviso", msg);
          return;
        }

        // Mapeia estruturando as informações financeiras de forma clara
        dataToExport = payments.map((pay: any) => ({
          'Aluno': pay.students?.name || 'Não Identificado',
          'Descrição da Parcela': pay.description || '',
          'Valor (R$)': pay.amount || 0,
          'Data de Vencimento': pay.due_date || '',
          'Situação / Status': pay.status === 'PENDENTE' ? '🔴 PENDENTE' : '🟢 PAGO'
        }));
      }

      // Geração da planilha básica usando SheetJS
      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, reportType);

      // Tratamento nativo focado em Web vs Mobile
      if (Platform.OS === 'web') {
        XLSX.writeFile(workbook, `${filename}.xlsx`);
      } else {
        // Processo mobile usando o FileSystem nativo do Expo + nativo share sheet
        const wbout = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
        const uri = FileSystem.documentDirectory + `${filename}.xlsx`;

        await FileSystem.writeAsStringAsync(uri, wbout, {
          encoding: FileSystem.EncodingType.Base64,
        });

        await Sharing.shareAsync(uri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Baixar Relatório',
          UTI: 'com.microsoft.excel.xlsx'
        });
      }

    } catch (e: any) {
      Platform.OS === 'web' ? alert("Erro: " + e.message) : Alert.alert("Erro ao exportar", e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Head><title>Relatórios | Budo</title></Head>
      <Stack.Screen options={{ title: 'Central de Relatórios' }} />

      <View style={styles.mainContent}>
        <View style={styles.cardHeader}>
          <Ionicons name="document-text-outline" size={32} color="#b31d1d" />
          <Text style={isMobile ? styles.titleMobile : styles.titleWeb}>Exportação de Dados</Text>
          <Text style={styles.subtitle}>Gere planilhas oficiais em formato .xlsx contendo o histórico consolidado do seu Dojo.</Text>
        </View>

        <View style={styles.formCard}>
          {/* SELETOR DE TIPO DE RELATÓRIO */}
          <Text style={styles.label}>1. Tipo de Relatório</Text>
          <View style={styles.pickerWrap}>
            <Picker
              selectedValue={reportType}
              onValueChange={(itemValue) => setReportType(itemValue)}
            >
              <Picker.Item label="Relatório Cadastral de Alunos" value="ALUNOS" />
              <Picker.Item label="Relatório Financeiro (Mensalidades)" value="FINANCEIRO" />
            </Picker>
          </View>

          {/* FILTRO CONDICIONAL DE FINANCEIRO (SÓ APARECE SE TIPO FOR FINANCEIRO) */}
          {reportType === 'FINANCEIRO' && (
            <View style={{ marginTop: 15 }}>
              <Text style={styles.label}>2. Filtrar Situação de Pagamento</Text>
              <View style={styles.pickerWrap}>
                <Picker
                  selectedValue={statusFilter}
                  onValueChange={(itemValue) => setStatusFilter(itemValue)}
                >
                  <Picker.Item label="Todos os Status" value="TODOS" />
                  <Picker.Item label="Apenas Pendentes 🔴" value="PENDENTE" />
                  <Picker.Item label="Apenas Pagos 🟢" value="PAGO" />
                </Picker>
              </View>
            </View>
          )}

          {/* BOTÃO DISPARADOR DINÂMICO */}
          <TouchableOpacity 
            style={[styles.btnExport, loading && { opacity: 0.7 }]} 
            onPress={generateExcelReport}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="download-outline" size={22} color="#fff" />
                <Text style={styles.btnText}>Gerar Planilha Excel (.xlsx)</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FE', justifyContent: 'center' },
  mainContent: { padding: 24, maxWidth: 600, width: '100%', alignSelf: 'center' },
  cardHeader: { alignItems: 'center', marginBottom: 25, textAlign: 'center' },
  titleWeb: { fontSize: 28, fontWeight: 'bold', color: '#1B2559', marginTop: 10 },
  titleMobile: { fontSize: 22, fontWeight: 'bold', color: '#1B2559', marginTop: 10 },
  subtitle: { color: '#A3AED0', textAlign: 'center', marginTop: 5, fontSize: 14, lineHeight: 20 },
  formCard: { backgroundColor: '#fff', borderRadius: 20, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  label: { fontWeight: '600', color: '#1B2559', marginBottom: 8, fontSize: 15 },
  pickerWrap: { backgroundColor: '#F4F7FE', borderRadius: 12, borderWidth: 1, borderColor: '#E0E5F2', overflow: 'hidden' },
  btnExport: { backgroundColor: '#b31d1d', flexDirection: 'row', padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 30, shadowColor: '#b31d1d', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});