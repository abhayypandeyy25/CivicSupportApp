import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Share,
  Dimensions,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Issue } from '../services/api';

const { width } = Dimensions.get('window');

interface IssueCardProps {
  issue: Issue;
  onUpvote: (issueId: string) => void;
  onPress?: (issue: Issue) => void;
  currentUserId?: string;
}

const categoryIcons: { [key: string]: string } = {
  roads: 'car-outline',
  sanitation: 'trash-outline',
  water: 'water-outline',
  electricity: 'flash-outline',
  encroachment: 'business-outline',
  parks: 'leaf-outline',
  public_safety: 'shield-outline',
  health: 'medkit-outline',
  education: 'school-outline',
  transport: 'bus-outline',
  housing: 'home-outline',
  general: 'information-circle-outline',
};

const statusColors: { [key: string]: string } = {
  pending: '#FF9800',
  in_progress: '#2196F3',
  resolved: '#4CAF50',
  closed: '#9E9E9E',
};

export default function IssueCard({ issue, onUpvote, onPress, currentUserId }: IssueCardProps) {
  const hasUpvoted = currentUserId && issue.upvoted_by?.includes(currentUserId);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out this civic issue: ${issue.title}\n\n${issue.description}\n\nLocation: ${issue.location?.address || issue.location?.area || 'Delhi'}`,
        title: issue.title,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleTwitterPress = () => {
    if (issue.twitter_data?.tweet_url) {
      Linking.openURL(issue.twitter_data.tweet_url);
    }
  };

  const isTwitterIssue = issue.source === 'twitter';
  const needsLocation = issue.location_status === 'pending';

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress?.(issue)}
      activeOpacity={0.9}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          {isTwitterIssue && issue.twitter_data?.twitter_profile_image ? (
            <Image
              source={{ uri: issue.twitter_data.twitter_profile_image }}
              style={styles.avatarImage}
            />
          ) : (
            <View style={[styles.avatar, isTwitterIssue && styles.avatarTwitter]}>
              <Text style={styles.avatarText}>
                {issue.user_name?.charAt(0)?.toUpperCase() || 'U'}
              </Text>
            </View>
          )}
          <View style={styles.userNameContainer}>
            <View style={styles.userNameRow}>
              <Text style={styles.userName}>{issue.user_name || 'Anonymous'}</Text>
              {isTwitterIssue && (
                <TouchableOpacity style={styles.twitterBadge} onPress={handleTwitterPress}>
                  <Ionicons name="logo-twitter" size={12} color="#1DA1F2" />
                  <Text style={styles.twitterHandle}>
                    @{issue.twitter_data?.twitter_username}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.timeText}>{formatDate(issue.created_at)}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          {needsLocation && (
            <View style={styles.locationNeededBadge}>
              <Ionicons name="location-outline" size={12} color="#FF9800" />
              <Text style={styles.locationNeededText}>Location needed</Text>
            </View>
          )}
          <View style={[styles.statusBadge, { backgroundColor: statusColors[issue.status] || '#9E9E9E' }]}>
            <Text style={styles.statusText}>{issue.status.replace('_', ' ')}</Text>
          </View>
        </View>
      </View>

      {/* Image */}
      {issue.photos && issue.photos.length > 0 && (
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: issue.photos[0].startsWith('data:') ? issue.photos[0] : `data:image/jpeg;base64,${issue.photos[0]}` }}
            style={styles.image}
            resizeMode="cover"
          />
          {issue.photos.length > 1 && (
            <View style={styles.photoCountBadge}>
              <Ionicons name="images-outline" size={14} color="#fff" />
              <Text style={styles.photoCountText}>{issue.photos.length}</Text>
            </View>
          )}
        </View>
      )}

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.categoryRow}>
          <View style={styles.categoryBadge}>
            <Ionicons
              name={categoryIcons[issue.category] as any || 'information-circle-outline'}
              size={14}
              color="#FF5722"
            />
            <Text style={styles.categoryText}>{issue.category.replace('_', ' ')}</Text>
          </View>
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {issue.title}
        </Text>
        <Text style={styles.description} numberOfLines={3}>
          {issue.description}
        </Text>

        {/* Location */}
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={14} color="#666" />
          <Text style={styles.locationText} numberOfLines={1}>
            {issue.location?.address || issue.location?.area || 'Delhi'}
          </Text>
        </View>

        {/* Assigned Official */}
        {issue.assigned_official_name && (
          <View style={styles.assignedRow}>
            <Ionicons name="person-outline" size={14} color="#4CAF50" />
            <Text style={styles.assignedText}>
              Assigned to: {issue.assigned_official_name}
            </Text>
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, hasUpvoted && styles.actionButtonActive]}
          onPress={() => onUpvote(issue.id)}
        >
          <Ionicons
            name={hasUpvoted ? 'arrow-up-circle' : 'arrow-up-circle-outline'}
            size={24}
            color={hasUpvoted ? '#FF5722' : '#666'}
          />
          <Text style={[styles.actionText, hasUpvoted && styles.actionTextActive]}>
            {issue.upvotes}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
          <Ionicons name="share-social-outline" size={22} color="#666" />
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF5722',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarTwitter: {
    backgroundColor: '#1DA1F2',
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  userNameContainer: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  twitterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 6,
  },
  twitterHandle: {
    fontSize: 11,
    color: '#1DA1F2',
    marginLeft: 3,
    fontWeight: '500',
  },
  timeText: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  locationNeededBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginBottom: 4,
  },
  locationNeededText: {
    fontSize: 10,
    color: '#FF9800',
    marginLeft: 3,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  imageContainer: {
    width: '100%',
    height: 200,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  photoCountBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  photoCountText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 4,
  },
  content: {
    padding: 12,
  },
  categoryRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 12,
    color: '#FF5722',
    marginLeft: 4,
    textTransform: 'capitalize',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 6,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  locationText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
    flex: 1,
  },
  assignedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: '#E8F5E9',
    padding: 8,
    borderRadius: 8,
  },
  assignedText: {
    fontSize: 12,
    color: '#4CAF50',
    marginLeft: 6,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
    paddingVertical: 4,
  },
  actionButtonActive: {},
  actionText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
  },
  actionTextActive: {
    color: '#FF5722',
    fontWeight: '600',
  },
});
