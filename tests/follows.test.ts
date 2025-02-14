import { ApolloServer } from 'apollo-server-express'
import { Mongoose } from 'mongoose'
import { Aggregates } from '../src/types'
import { ApolloServerTestClient } from 'apollo-server-testing/dist/createTestClient'
import { buildAggregates, connectMongoose, createServer } from '../src/server'
import { createTestClient } from 'apollo-server-testing'
import {
  FOLLOW_CHANNEL,
  FollowChannel,
  FollowChannelArgs,
  GET_CHANNEL_FOLLOWS,
  GetChannelFollows,
  GetChannelFollowsArgs,
  UNFOLLOW_CHANNEL,
  UnfollowChannel,
  UnfollowChannelArgs,
  GET_MOST_FOLLOWED_CHANNELS,
  GetMostFollowedChannels,
  GetMostFollowedChannelsArgs,
  GET_MOST_FOLLOWED_CHANNELS_ALL_TIME,
  GetMostFollowedChannelsAllTime,
  GetMostFollowedChannelsAllTimeArgs,
} from './queries/follows'
import { ChannelFollowsInfo } from '../src/entities/ChannelFollowsInfo'
import { ChannelEventsBucketModel } from '../src/models/ChannelEvent'
import { TEST_BUCKET_SIZE } from './setup'

const FIRST_CHANNEL_ID = '22'
const SECOND_CHANNEL_ID = '23'

describe('Channel follows resolver', () => {
  let server: ApolloServer
  let mongoose: Mongoose
  let aggregates: Aggregates
  let query: ApolloServerTestClient['query']
  let mutate: ApolloServerTestClient['mutate']

  beforeEach(async () => {
    mongoose = await connectMongoose(process.env.MONGO_URL!)
    aggregates = await buildAggregates()
    server = await createServer(mongoose, aggregates)
    const testClient = createTestClient(server)
    query = testClient.query
    mutate = testClient.mutate
  })

  afterEach(async () => {
    await server.stop()
    await ChannelEventsBucketModel.deleteMany({})
    await mongoose.disconnect()
  })

  const followChannel = async (channelId: string) => {
    const followChannelResponse = await mutate<FollowChannel, FollowChannelArgs>({
      mutation: FOLLOW_CHANNEL,
      variables: { channelId },
    })
    expect(followChannelResponse.errors).toBeUndefined()
    return followChannelResponse.data?.followChannel
  }

  const unfollowChannel = async (channelId: string) => {
    const unfollowChannelResponse = await mutate<UnfollowChannel, UnfollowChannelArgs>({
      mutation: UNFOLLOW_CHANNEL,
      variables: { channelId },
    })
    expect(unfollowChannelResponse.errors).toBeUndefined()
    return unfollowChannelResponse.data?.unfollowChannel
  }

  const getChannelFollows = async (channelId: string) => {
    const channelFollowsResponse = await query<GetChannelFollows, GetChannelFollowsArgs>({
      query: GET_CHANNEL_FOLLOWS,
      variables: { channelId },
    })
    expect(channelFollowsResponse.errors).toBeUndefined()
    return channelFollowsResponse.data?.channelFollows
  }

  const getMostFollowedChannels = async (timePeriodDays: number) => {
    const mostFollowedChannelsResponse = await query<GetMostFollowedChannels, GetMostFollowedChannelsArgs>({
      query: GET_MOST_FOLLOWED_CHANNELS,
      variables: { timePeriodDays },
    })
    expect(mostFollowedChannelsResponse.errors).toBeUndefined()
    return mostFollowedChannelsResponse.data?.mostFollowedChannels
  }

  const getMostFollowedChannelsAllTime = async (limit: number) => {
    const mostFollowedChannelsAllTimeResponse = await query<
      GetMostFollowedChannelsAllTime,
      GetMostFollowedChannelsAllTimeArgs
    >({
      query: GET_MOST_FOLLOWED_CHANNELS_ALL_TIME,
      variables: { limit },
    })
    expect(mostFollowedChannelsAllTimeResponse.errors).toBeUndefined()
    return mostFollowedChannelsAllTimeResponse.data?.mostFollowedChannelsAllTime
  }

  it('should return null for unknown channel follows', async () => {
    const channelFollows = await getChannelFollows(FIRST_CHANNEL_ID)
    const mostFollowedChannels = await getMostFollowedChannels(30)
    const mostFollowedChannelsAllTime = await getMostFollowedChannelsAllTime(10)

    expect(channelFollows).toBeNull()
    expect(mostFollowedChannels).toHaveLength(0)
    expect(mostFollowedChannelsAllTime).toHaveLength(0)
  })

  it('should properly handle channel follow', async () => {
    const expectedChannelFollows: ChannelFollowsInfo = {
      id: FIRST_CHANNEL_ID,
      follows: 1,
    }

    let addChannelFollowData = await followChannel(FIRST_CHANNEL_ID)
    expect(addChannelFollowData).toEqual(expectedChannelFollows)

    let channelFollows = await getChannelFollows(FIRST_CHANNEL_ID)
    let mostFollowedChannels = await getMostFollowedChannels(30)
    let mostFollowedChannelsAllTime = await getMostFollowedChannelsAllTime(10)
    expect(channelFollows).toEqual(expectedChannelFollows)
    expect(mostFollowedChannels).toEqual([expectedChannelFollows])
    expect(mostFollowedChannelsAllTime).toEqual([expectedChannelFollows])

    expectedChannelFollows.follows++

    addChannelFollowData = await followChannel(FIRST_CHANNEL_ID)
    expect(addChannelFollowData).toEqual(expectedChannelFollows)

    channelFollows = await getChannelFollows(FIRST_CHANNEL_ID)
    mostFollowedChannels = await getMostFollowedChannels(30)
    mostFollowedChannelsAllTime = await getMostFollowedChannelsAllTime(10)
    expect(channelFollows).toEqual(expectedChannelFollows)
    expect(mostFollowedChannels).toEqual([expectedChannelFollows])
    expect(mostFollowedChannelsAllTime).toEqual([expectedChannelFollows])
  })

  it('should properly handle channel unfollow', async () => {
    const expectedChannelFollows: ChannelFollowsInfo = {
      id: FIRST_CHANNEL_ID,
      follows: 5,
    }

    await followChannel(FIRST_CHANNEL_ID)
    await followChannel(FIRST_CHANNEL_ID)
    await followChannel(FIRST_CHANNEL_ID)
    await followChannel(FIRST_CHANNEL_ID)
    await followChannel(FIRST_CHANNEL_ID)

    let channelFollows = await getChannelFollows(FIRST_CHANNEL_ID)
    let mostFollowedChannels = await getMostFollowedChannels(30)
    let mostFollowedChannelsAllTime = await getMostFollowedChannelsAllTime(10)
    expect(channelFollows).toEqual(expectedChannelFollows)
    expect(mostFollowedChannels).toEqual([expectedChannelFollows])
    expect(mostFollowedChannelsAllTime).toEqual([expectedChannelFollows])

    expectedChannelFollows.follows--

    const unfollowChannelData = await unfollowChannel(FIRST_CHANNEL_ID)
    expect(unfollowChannelData).toEqual(expectedChannelFollows)

    channelFollows = await getChannelFollows(FIRST_CHANNEL_ID)
    mostFollowedChannels = await getMostFollowedChannels(30)
    mostFollowedChannelsAllTime = await getMostFollowedChannelsAllTime(10)
    expect(channelFollows).toEqual(expectedChannelFollows)
    expect(mostFollowedChannels).toEqual([expectedChannelFollows])
    expect(mostFollowedChannelsAllTime).toEqual([expectedChannelFollows])
  })

  it('should keep the channel follows non-negative', async () => {
    const expectedChannelFollows: ChannelFollowsInfo = {
      id: FIRST_CHANNEL_ID,
      follows: 0,
    }

    await followChannel(FIRST_CHANNEL_ID)
    await followChannel(FIRST_CHANNEL_ID)

    await unfollowChannel(FIRST_CHANNEL_ID)
    await unfollowChannel(FIRST_CHANNEL_ID)
    await unfollowChannel(FIRST_CHANNEL_ID)

    const channelFollows = await getChannelFollows(FIRST_CHANNEL_ID)
    const mostFollowedChannels = await getMostFollowedChannels(30)
    const mostFollowedChannelsAllTime = await getMostFollowedChannelsAllTime(10)
    expect(channelFollows).toEqual(expectedChannelFollows)
    expect(mostFollowedChannels).toEqual([expectedChannelFollows])
    expect(mostFollowedChannelsAllTime).toEqual([expectedChannelFollows])
  })

  it('should distinct follows of separate channels', async () => {
    const expectedFirstChannelFollows: ChannelFollowsInfo = {
      id: FIRST_CHANNEL_ID,
      follows: 1,
    }
    const expectedSecondChannelFollows: ChannelFollowsInfo = {
      id: SECOND_CHANNEL_ID,
      follows: 1,
    }

    const firstChannelFollowData = await followChannel(FIRST_CHANNEL_ID)
    const secondChannelFollowData = await followChannel(SECOND_CHANNEL_ID)

    expect(firstChannelFollowData).toEqual(expectedFirstChannelFollows)
    expect(secondChannelFollowData).toEqual(expectedSecondChannelFollows)

    expectedFirstChannelFollows.follows++

    await followChannel(FIRST_CHANNEL_ID)

    const firstChannelFollows = await getChannelFollows(FIRST_CHANNEL_ID)
    const secondChannelFollows = await getChannelFollows(SECOND_CHANNEL_ID)
    const mostFollowedChannels = await getMostFollowedChannels(30)
    const mostFollowedChannelsAllTime = await getMostFollowedChannelsAllTime(10)

    expect(firstChannelFollows).toEqual(expectedFirstChannelFollows)
    expect(secondChannelFollows).toEqual(expectedSecondChannelFollows)
    expect(mostFollowedChannels).toEqual([expectedFirstChannelFollows, expectedSecondChannelFollows])
    expect(mostFollowedChannelsAllTime).toEqual([expectedFirstChannelFollows, expectedSecondChannelFollows])
  })

  it('should properly rebuild the aggregate', async () => {
    const expectedFirstChannelFollows: ChannelFollowsInfo = {
      id: FIRST_CHANNEL_ID,
      follows: 3,
    }
    const expectedSecondChannelFollows: ChannelFollowsInfo = {
      id: SECOND_CHANNEL_ID,
      follows: 4,
    }

    const checkFollows = async () => {
      const firstChannelFollows = await getChannelFollows(FIRST_CHANNEL_ID)
      const secondChannelFollows = await getChannelFollows(SECOND_CHANNEL_ID)
      const mostFollowedChannels = await getMostFollowedChannels(30)
      const mostFollowedChannelsAllTime = await getMostFollowedChannelsAllTime(10)

      expect(firstChannelFollows).toEqual(expectedFirstChannelFollows)
      expect(secondChannelFollows).toEqual(expectedSecondChannelFollows)
      expect(mostFollowedChannels).toEqual([expectedSecondChannelFollows, expectedFirstChannelFollows])
      expect(mostFollowedChannelsAllTime).toEqual([expectedSecondChannelFollows, expectedFirstChannelFollows])
    }

    await followChannel(FIRST_CHANNEL_ID)
    await followChannel(FIRST_CHANNEL_ID)
    await followChannel(FIRST_CHANNEL_ID)

    await followChannel(SECOND_CHANNEL_ID)
    await followChannel(SECOND_CHANNEL_ID)
    await followChannel(SECOND_CHANNEL_ID)
    await followChannel(SECOND_CHANNEL_ID)
    await followChannel(SECOND_CHANNEL_ID)
    await unfollowChannel(SECOND_CHANNEL_ID)

    await checkFollows()

    await server.stop()
    aggregates = await buildAggregates()
    server = await createServer(mongoose, aggregates)
    const testClient = createTestClient(server)
    query = testClient.query
    mutate = testClient.mutate

    await checkFollows()
  })

  it('should properly handle saving events across buckets', async () => {
    const eventsCount = TEST_BUCKET_SIZE * 2 + 1

    const expectedChannelFollows: ChannelFollowsInfo = {
      id: FIRST_CHANNEL_ID,
      follows: eventsCount,
    }

    for (let i = 0; i < eventsCount; i++) {
      await followChannel(FIRST_CHANNEL_ID)
    }

    const channelFollows = await getChannelFollows(FIRST_CHANNEL_ID)
    const mostFollowedChannels = await getMostFollowedChannels(30)
    const mostFollowedChannelsAllTime = await getMostFollowedChannelsAllTime(10)
    expect(channelFollows).toEqual(expectedChannelFollows)
    expect(mostFollowedChannels).toEqual([expectedChannelFollows])
    expect(mostFollowedChannelsAllTime).toEqual([expectedChannelFollows])
  })
})
