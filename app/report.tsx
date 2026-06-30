import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
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

// Lista oficial de faixas do Dojo para o filtro
const FAIXAS_DISPONIVEIS = ['Branca', 'Amarela', 'Vermelha', 'Laranja', 'Verde', 'Roxa', 'Marrom', 'Preta'];

export default function DashboardRelatorios() {
  const [loading, setLoading] = useState(false);
  const [dojoId, setDojoId] = useState<string | null>(null);
  
  // Estados dos Filtros Modificados
  const [reportType, setReportType] = useState<ReportType>('ALUNOS');
  const [statusFilter, setStatusFilter] = useState<FinanceStatusFilter>('TODOS');
  const [faixasSelecionadas, setFaixasSelecionadas] = useState<string[]>([]);

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

  // Alternador do filtro de faixas (Multi-seleção)
  const toggleFaixa = (faixa: string) => {
    if (faixasSelecionadas.includes(faixa)) {
      setFaixasSelecionadas(faixasSelecionadas.filter(f => f !== faixa));
    } else {
      setFaixasSelecionadas([...faixasSelecionadas, faixa]);
    }
  };

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
        let query = supabase
          .from('students')
          .select('name, belt, birth_date, cpf, email, phone, guardian_name, city, state, address')
          .eq('dojo_id', dojoId)
          .order('name');

        // Se houver faixas selecionadas, aplica o filtro na query do banco
        if (faixasSelecionadas.length > 0) {
          query = query.in('belt', faixasSelecionadas);
        }

        const { data: students, error } = await query;
        if (error) throw error;

        if (!students || students.length === 0) {
          const msg = "Nenhum aluno encontrado para os filtros selecionados.";
          Platform.OS === 'web' ? alert(msg) : Alert.alert("Aviso", msg);
          return;
        }

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
        let query = supabase
          .from('payments')
          .select(`
            amount,
            description,
            due_date,
            status,
            students ( name, belt )
          `)
          .eq('dojo_id', dojoId)
          .order('due_date', { ascending: true });

        if (statusFilter !== 'TODOS') {
          query = query.eq('status', statusFilter);
        }

        const { data: payments, error } = await query;
        if (error) throw error;

        // Filtra os pagamentos localmente caso queira cruzar com o filtro de faixas do aluno relacionado
        let filteredPayments = payments || [];
        if (faixasSelecionadas.length > 0) {
          filteredPayments = filteredPayments.filter((pay: any) => 
            faixasSelecionadas.includes(pay.students?.belt)
          );
        }

        if (filteredPayments.length === 0) {
          const msg = "Nenhum registro financeiro encontrado com os filtros selecionados.";
          Platform.OS === 'web' ? alert(msg) : Alert.alert("Aviso", msg);
          return;
        }

        dataToExport = filteredPayments.map((pay: any) => ({
          'Aluno': pay.students?.name || 'Não Identificado',
          'Faixa do Aluno': pay.students?.belt || '',
          'Descrição da Parcela': pay.description || '',
          'Valor (R$)': pay.amount || 0,
          'Data de Vencimento': pay.due_date || '',
          'Situação / Status': pay.status === 'PENDENTE' ? '🔴 PENDENTE' : '🟢 PAGO'
        }));
      }

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, reportType);

      if (Platform.OS === 'web') {
        XLSX.writeFile(workbook, `${filename}.xlsx`);
      } else {
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
          {/* 1. SELEÇÃO DO TIPO DE RELATÓRIO */}
          <Text style={styles.label}>1. Tipo de Relatório</Text>
          <View style={styles.toggleGroup}>
            <TouchableOpacity 
              style={[styles.toggleButton, reportType === 'ALUNOS' && styles.toggleActive]}
              onPress={() => setReportType('ALUNOS')}
            >
              <Text style={[styles.toggleText, reportType === 'ALUNOS' && styles.toggleTextActive]}>
                Cadastral de Alunos
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.toggleButton, reportType === 'FINANCEIRO' && styles.toggleActive]}
              onPress={() => setReportType('FINANCEIRO')}
            >
              <Text style={[styles.toggleText, reportType === 'FINANCEIRO' && styles.toggleTextActive]}>
                Financeiro (Mensalidades)
              </Text>
            </TouchableOpacity>
          </View>

          {/* 2. FILTRO POR FAIXAS (ADICIONADO) */}
          <Text style={styles.label}>2. Filtrar por Graduação / Faixa</Text>
          <Text style={styles.subLabel}>Se nenhuma for marcada, trará todas as faixas por padrão.</Text>
          <View style={styles.chipsContainer}>
            {FAIXAS_DISPONIVEIS.map((faixa) => {
              const isSelected = faixasSelecionadas.includes(faixa);
              return (
                <TouchableOpacity
                  key={faixa}
                  style={[styles.chip, isSelected && styles.chipSelected]}
                  onPress={() => toggleFaixa(faixa)}
                >
                  {isSelected && <Ionicons name="checkmark" size={14} color="#fff" style={{ marginRight: 4 }} />}
                  <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                    {faixa}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 3. FILTRO CONDICIONAL DE FINANCEIRO */}
          {reportType === 'FINANCEIRO' && (
            <View style={{ marginTop: 5 }}>
              <Text style={styles.label}>3. Situação de Pagamento</Text>
              <View style={styles.toggleGroup}>
                <TouchableOpacity 
                  style={[styles.toggleButton, statusFilter === 'TODOS' && styles.toggleActive]}
                  onPress={() => setStatusFilter('TODOS')}
                >
                  <Text style={[styles.toggleText, statusFilter === 'TODOS' && styles.toggleTextActive]}>Todos</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.toggleButton, statusFilter === 'PENDENTE' && styles.toggleActive]}
                  onPress={() => setStatusFilter('PENDENTE')}
                >
                  <Text style={[styles.toggleText, statusFilter === 'PENDENTE' && styles.toggleTextActive]}>Pendentes 🔴</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.toggleButton, statusFilter === 'PAGO' && styles.toggleActive]}
                  onPress={() => setStatusFilter('PAGO')}
                >
                  <Text style={[styles.toggleText, statusFilter === 'PAGO' && styles.toggleTextActive]}>Pagos 🟢</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* BOTÃO DISPARADOR */}
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
  label: { fontWeight: '600', color: '#1B2559', marginBottom: 10, fontSize: 15, marginTop: 5 },
  subLabel: { fontSize: 12, color: '#A3AED0', marginTop: -6, marginBottom: 10 },
  
  // Estilos dos Novos Seletores de Botão
  toggleGroup: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  toggleButton: { flex: 1, backgroundColor: '#F4F7FE', paddingVertical: 12, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, borderColor: '#E0E5F2', alignItems: 'center', justifyContent: 'center' },
  toggleActive: { borderColor: '#b31d1d', backgroundColor: '#FFF5F5' },
  toggleText: { fontSize: 13, color: '#A3AED0', fontWeight: '500', textAlign: 'center' },
  toggleTextActive: { color: '#b31d1d', fontWeight: 'bold' },

  // Estilos dos Chips de Faixa
  chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 20 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: '#E0E5F2', backgroundColor: '#F4F7FE' },
  chipSelected: { backgroundColor: '#b31d1d', borderColor: '#b31d1d' },
  chipText: { fontSize: 13, color: '#1B2559' },
  chipTextSelected: { color: '#fff', fontWeight: '600' },

  btnExport: { backgroundColor: '#b31d1d', flexDirection: 'row', padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 15, shadowColor: '#b31d1d', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});