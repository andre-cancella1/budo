import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router'; // Importante para sumir com a barra
import Head from 'expo-router/head'; // Importação importante
import React, { useState } from 'react';
import {
    Alert,
    Image,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);


    async function handleLogin() {
        if (!email || !password) {
            Alert.alert('Erro', 'Preencha email e senha');
            return;
        }

        setLoading(true);

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        setLoading(false);

        if (error) {
            Alert.alert('Erro no login', error.message);
        } else {
            router.replace('/home');
        }
    }


    return (
        <>
            <Head>
                <title>Login | Budo</title>
                <meta name="description" content="Página de Login" />
            </Head>
            <SafeAreaView style={styles.background}>
                {/* 1. Remove a barra preta "index" */}
                <Stack.Screen options={{ headerShown: false }} />

                {/* 2. Deixa os ícones da bateria/hora brancos para combinar com o fundo */}
                <StatusBar barStyle="light-content" />

                <View style={styles.card}>
                    {/* Header com o Kimono */}
                    <View style={styles.logoContainer}>
                        <View style={styles.logoCircle}>
                            <Image
                                source={require('../assets/images/kimono.png')} // Certifique-se que o caminho está correto
                                style={styles.kimonoImage}
                                resizeMode="contain"
                            />
                        </View>
                    </View>

                    {/* Formulário */}
                    <View style={styles.form}>
                        <View style={styles.inputGroup}>
                            <View style={styles.iconContainer}>
                                <Ionicons name="person" size={20} color="#fff" />
                            </View>
                            <TextInput
                                style={styles.input}
                                placeholder="E-mail"
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                placeholderTextColor="#999"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <View style={styles.iconContainer}>
                                <Ionicons name="key" size={20} color="#fff" />
                            </View>
                            <TextInput
                                style={styles.input}
                                placeholder="••••••"
                                secureTextEntry
                                value={password}
                                onChangeText={setPassword}
                                placeholderTextColor="#999"
                            />
                        </View>

                        <TouchableOpacity
                            style={styles.loginButton}
                            onPress={handleLogin}
                            disabled={loading}
                        >
                            <Text style={styles.buttonText}>
                                {loading ? 'Entrando...' : 'Login'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Links de Rodapé */}
                    <View style={styles.footer}>
                        <Text style={styles.footerText}>
                            Não possui uma conta? <Text style={styles.linkText}>Cadastre</Text>
                        </Text>
                        <TouchableOpacity>
                            <Text style={styles.forgotText}>Esqueceu sua senha?</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </SafeAreaView>
        </>
    );
}

const styles = StyleSheet.create({
    background: {
        flex: 1,
        backgroundColor: '#b31d1d',
        justifyContent: 'center',
        alignItems: 'center',
    },
    card: {
        backgroundColor: '#f2f2f2',
        width: '85%',
        maxWidth: 340,
        borderRadius: 12,
        padding: 25,
        paddingTop: 70, // Espaço maior por causa do círculo
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 10,
    },
    logoContainer: {
        position: 'absolute',
        top: -65,
        alignSelf: 'center',
    },
    logoCircle: {
        width: 130,
        height: 130,
        backgroundColor: '#b31d1d',
        borderRadius: 65,
        borderWidth: 5,
        borderColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    kimonoImage: {
        width: 90,
        height: 90,
    },
    form: {
        marginTop: 20,
    },
    inputGroup: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 5,
        marginBottom: 15,
        height: 50,
        overflow: 'hidden',
    },
    iconContainer: {
        backgroundColor: '#8b1a1a',
        width: 50,
        justifyContent: 'center',
        alignItems: 'center',
    },
    input: {
        flex: 1,
        paddingHorizontal: 15,
        fontSize: 16,
        color: '#333',
    },
    loginButton: {
        backgroundColor: '#b31d1d',
        paddingVertical: 15,
        borderRadius: 5,
        alignItems: 'center',
        marginTop: 10,
    },
    buttonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 18,
    },
    footer: {
        marginTop: 25,
        alignItems: 'center',
    },
    footerText: {
        color: '#555',
        fontSize: 14,
    },
    linkText: {
        color: '#4a90e2',
        fontWeight: '500',
    },
    forgotText: {
        color: '#4a90e2',
        marginTop: 8,
        fontSize: 14,
    },
});
