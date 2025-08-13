import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createPublicClient, http } from 'viem';
import { sophonTestnet } from '../../config/chains';
import { kv } from '@vercel/kv';
import storeAbi from '../../abi/storeV2.json';
import jobsAbi from '../../abi/jobsV2.json';
import { corsHeaders } from '../cors';

const STORE_CONTRACT = (process.env.NEXT_PUBLIC_STORE_CONTRACT || '0x9af4b8A05B001A7dCbfD428C444f73Ff7d10d520') as `0x${string}`;
const JOBS_CONTRACT = (process.env.NEXT_PUBLIC_JOBS_CONTRACT || '0x935f8Fd143720B337c521354a545a342DF584D18') as `0x${string}`;
const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x10Af06Bb43F5ed51A289d22641135c6fC97987Ad') as `0x${string}`;
const RPC_URL = process.env.RPC_URL || 'https://rpc.testnet.sophon.xyz';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\n/g, '') || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/\n/g, '') || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function OPTIONS(request: NextRequest) {
    return new NextResponse(null, { status: 200, headers: corsHeaders() });
}

export async function GET(request: NextRequest) {
    const headers = corsHeaders();
    
    try {
        // Initialize blockchain client
        const publicClient = createPublicClient({
            chain: sophonTestnet,
            transport: http(RPC_URL),
        });

        // Get blockchain data
        const [
            totalPurchases,
            albumPrice,
            storeBalance,
            totalClaimed,
            totalUsdcDistributed,
            totalUsersPaid
        ] = await Promise.all([
            publicClient.readContract({
                address: STORE_CONTRACT,
                abi: storeAbi,
                functionName: 'totalPurchases',
            }) as Promise<bigint>,
            publicClient.readContract({
                address: STORE_CONTRACT,
                abi: storeAbi,
                functionName: 'albumPrice',
            }) as Promise<bigint>,
            publicClient.readContract({
                address: STORE_CONTRACT,
                abi: storeAbi,
                functionName: 'getContractBalance',
            }) as Promise<bigint>,
            publicClient.readContract({
                address: JOBS_CONTRACT,
                abi: jobsAbi,
                functionName: 'totalClaimedFromStore',
            }) as Promise<bigint>,
            publicClient.readContract({
                address: JOBS_CONTRACT,
                abi: jobsAbi,
                functionName: 'totalUsdcDistributed',
            }) as Promise<bigint>,
            publicClient.readContract({
                address: JOBS_CONTRACT,
                abi: jobsAbi,
                functionName: 'totalUsersPaid',
            }) as Promise<bigint>,
        ]);

        // Get KV analytics data
        const [
            uniqueIps,
            totalWalletsGenerated,
            recentWallets,
            walletIndex
        ] = await Promise.all([
            kv.scard('unique_ips'),
            kv.get('total_wallets_generated'),
            kv.lrange('recent_wallets', 0, 9), // Get last 10 wallets
            kv.get('wallet_index')
        ]);

        // Get Supabase IP tracking data if available
        let ipTrackingData = {
            uniqueVisitors: 0,
            totalPageViews: 0,
            topCountries: [],
            recentVisits: []
        };

        try {
            // Get unique IPs from Supabase
            const { data: ipData, error } = await supabase
                .from('ip_visits')
                .select('ip_address, country, city, created_at')
                .order('created_at', { ascending: false })
                .limit(100);

            if (!error && ipData) {
                const uniqueIpSet = new Set(ipData.map(d => d.ip_address));
                ipTrackingData.uniqueVisitors = uniqueIpSet.size;
                ipTrackingData.totalPageViews = ipData.length;
                
                // Count by country
                const countryCount: { [key: string]: number } = {};
                ipData.forEach(d => {
                    if (d.country) {
                        countryCount[d.country] = (countryCount[d.country] || 0) + 1;
                    }
                });
                
                ipTrackingData.topCountries = Object.entries(countryCount)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([country, count]) => ({ country, count }));
                    
                ipTrackingData.recentVisits = ipData.slice(0, 5).map(d => ({
                    ip: d.ip_address,
                    country: d.country,
                    city: d.city,
                    timestamp: d.created_at
                }));
            }
        } catch (supabaseError) {
            console.log('Supabase data not available:', supabaseError);
        }

        // Parse recent wallets
        const parsedRecentWallets = recentWallets?.map((w: any) => {
            try {
                return typeof w === 'string' ? JSON.parse(w) : w;
            } catch {
                return null;
            }
        }).filter(Boolean) || [];

        // Calculate revenue metrics
        const totalRevenue = Number(totalPurchases) * Number(albumPrice) / 1e6; // Convert to USDC
        const averageRevenuePerWallet = totalWalletsGenerated ? totalRevenue / Number(totalWalletsGenerated) : 0;

        return NextResponse.json({
            blockchain: {
                totalAlbumsSold: totalPurchases.toString(),
                albumPrice: (Number(albumPrice) / 1e6).toFixed(2) + ' USDC',
                totalRevenue: totalRevenue.toFixed(2) + ' USDC',
                storeBalance: (Number(storeBalance) / 1e6).toFixed(2) + ' USDC',
                totalClaimedByJobs: (Number(totalClaimed) / 1e6).toFixed(2) + ' USDC',
                totalDistributed: (Number(totalUsdcDistributed) / 1e6).toFixed(2) + ' USDC',
                totalUsersPaid: totalUsersPaid.toString()
            },
            wallets: {
                totalGenerated: totalWalletsGenerated || 0,
                currentIndex: walletIndex || 0,
                uniqueIpsFromGeneration: uniqueIps || 0,
                averageRevenuePerWallet: averageRevenuePerWallet.toFixed(4) + ' USDC',
                recentWallets: parsedRecentWallets
            },
            traffic: ipTrackingData,
            contracts: {
                store: STORE_CONTRACT,
                jobs: JOBS_CONTRACT,
                usdc: USDC_ADDRESS
            },
            timestamp: new Date().toISOString()
        }, { headers });
    } catch (err: any) {
        console.error('Analytics error:', err);
        return NextResponse.json(
            { error: err.message || 'Failed to fetch analytics' },
            { status: 500, headers }
        );
    }
}