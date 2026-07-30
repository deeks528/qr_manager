import React, { useEffect, useRef } from 'react';
import { SafeAreaView, StyleSheet, Text, View, ActivityIndicator, Animated, Image } from 'react-native';

interface SplashProps {
    title?: string;
    subtitle?: string;
}

export function Splash({ title = 'Universal QR Profile Manager', subtitle = 'Starting up...' }: SplashProps) {
    const pulseAnim = useRef(new Animated.Value(0.8)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.1,
                    duration: 800,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 0.8,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, [pulseAnim]);

    return (
        <SafeAreaView style={styles.centered}>
            <View style={styles.content}>
                <Animated.View style={[styles.iconContainer, { transform: [{ scale: pulseAnim }] }]}>
                    <Image
                        source={require('../../../assets/logo.jpg')}
                        style={styles.logo}
                        resizeMode="cover"
                    />
                </Animated.View>
                <Text style={styles.title}>{title}</Text>
                <ActivityIndicator size="large" color="#2563EB" style={styles.spinner} />
                <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    centered: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    iconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
        borderWidth: 2,
        borderColor: '#BFDBFE',
        overflow: 'hidden', // Ensure image stays within the circle
    },
    logo: {
        width: '100%',
        height: '100%',
    },
    iconText: {
        fontSize: 40,
    },
    title: {
        color: '#0F172A',
        fontSize: 22,
        fontWeight: '700',
        textAlign: 'center',
    },
    spinner: {
        marginTop: 16,
    },
    subtitle: {
        marginTop: 12,
        color: '#64748B',
        fontSize: 15,
        textAlign: 'center',
    },
});

export default Splash;
