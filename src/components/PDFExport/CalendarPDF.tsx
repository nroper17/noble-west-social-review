import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer'
import { format, parseISO } from 'date-fns'
import type { Post, Workspace, Comment } from '../../types'

// Register fonts (resolves relative to the root URL in standard Vite setup)
Font.register({
  family: 'Bebas Neue',
  src: window.location.origin + '/fonts/BebasNeue-Regular.ttf'
})

Font.register({
  family: 'Josefin Sans',
  src: window.location.origin + '/fonts/JosefinSans-Variable.ttf'
})

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Josefin Sans',
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E2DC',
    paddingBottom: 20,
  },
  logo: {
    width: 140,
  },
  headerInfo: {
    textAlign: 'right',
  },
  workspaceName: {
    fontFamily: 'Bebas Neue',
    fontSize: 24,
    color: '#14473e', // Forester
  },
  monthString: {
    fontSize: 12,
    color: '#a26828', // Dusty
    marginTop: 4,
    textTransform: 'uppercase',
  },
  postContainer: {
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  postTitle: {
    fontFamily: 'Bebas Neue',
    fontSize: 20,
    color: '#111c15', // Onyx
    flex: 1,
  },
  postDate: {
    fontSize: 12,
    color: '#917941', // Gilded
    fontWeight: 'bold',
  },
  postMeta: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 12,
  },
  metaBadge: {
    fontSize: 9,
    backgroundColor: '#F5F3EF', // bg
    padding: '4px 8px',
    borderRadius: 4,
    color: '#666',
    textTransform: 'uppercase',
  },
  statusBadge: {
    fontSize: 9,
    padding: '4px 8px',
    borderRadius: 4,
    textTransform: 'uppercase',
    color: '#fff',
  },
  postContent: {
    flexDirection: 'column',
    gap: 15,
  },
  assetsContainer: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  assetImageSmall: {
    width: 140,
    height: 140,
    objectFit: 'contain',
    borderRadius: 4,
    backgroundColor: '#000',
  },
  assetImageSingle: {
    width: 240,
    height: 240,
    objectFit: 'contain',
    borderRadius: 4,
    backgroundColor: '#000',
  },
  copyContainer: {
    width: '100%',
  },
  copyText: {
    fontSize: 11,
    lineHeight: 1.5,
    color: '#333',
  },
  commentsSection: {
    marginTop: 15,
    padding: 10,
    backgroundColor: '#F5F3EF',
    borderRadius: 4,
  },
  commentsTitle: {
    fontSize: 10,
    fontFamily: 'Bebas Neue',
    color: '#14473e',
    marginBottom: 8,
  },
  commentItem: {
    marginBottom: 8,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  commentAuthor: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#111c15',
  },
  commentDate: {
    fontSize: 8,
    color: '#888',
  },
  commentBody: {
    fontSize: 10,
    color: '#444',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#E5E2DC',
    paddingTop: 10,
  },
  footerText: {
    fontSize: 9,
    color: '#888',
  },
  pageNumber: {
    fontSize: 9,
    color: '#888',
  }
})

function getStatusColor(status: string) {
  switch(status) {
    case 'approved': return '#3A7D44'
    case 'needs_revision': return '#C97B2A'
    case 'pending_review': return '#4A7FB5'
    default: return '#A0A0A0'
  }
}

// Strip HTML for PDF text rendering
function stripHtml(html: string) {
  if (typeof window === 'undefined') return html.replace(/<[^>]+>/g, '')
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return doc.body.textContent || ''
}

interface CalendarPDFProps {
  workspace: Workspace
  posts: Post[]
  clientComments: Comment[]
  month: number
  year: number
}

export default function CalendarPDF({ workspace, posts, clientComments, month, year }: CalendarPDFProps) {
  const monthName = format(new Date(year, month - 1), 'MMMM yyyy')
  const timestamp = format(new Date(), 'MMM d, yyyy h:mm a')

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed>
          <Image 
            src={window.location.origin + '/NobleWest_Logo Full_forester.png'} 
            style={styles.logo} 
          />
          <View style={styles.headerInfo}>
            <Text style={styles.workspaceName}>{workspace.name}</Text>
            <Text style={styles.monthString}>{monthName} Content Calendar</Text>
          </View>
        </View>

        {posts.map(post => {
          const postComments = clientComments.filter(c => c.post_id === post.id)
          
          return (
            <View key={post.id} style={styles.postContainer} wrap={false}>
              <View style={styles.postHeader}>
                <Text style={styles.postTitle}>{post.title}</Text>
                <Text style={styles.postDate}>{format(parseISO(post.proposed_date), 'MMM d, yyyy')}</Text>
              </View>

              <View style={styles.postMeta}>
                <Text style={[styles.statusBadge, { backgroundColor: getStatusColor(post.status) }]}>
                  {post.status.replace('_', ' ')}
                </Text>
                <Text style={styles.metaBadge}>
                  {post.platforms.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' · ')}
                </Text>
              </View>

              <View style={styles.postContent}>
                {post.asset_type !== 'video_link' && post.assets && post.assets.length > 0 && (
                  <View style={styles.assetsContainer}>
                    {post.assets.map((asset, i) => (
                      <Image 
                        key={i} 
                        src={asset.url} 
                        style={post.assets.length === 1 ? styles.assetImageSingle : styles.assetImageSmall} 
                      />
                    ))}
                  </View>
                )}
                
                <View style={styles.copyContainer}>
                  <Text style={styles.copyText}>{stripHtml(post.copy)}</Text>
                  
                  {post.asset_type === 'video_link' && post.asset_url && (
                    <Text style={[styles.copyText, { marginTop: 10, color: '#4A7FB5' }]}>
                      Video Link: {post.asset_url}
                    </Text>
                  )}
                </View>
              </View>

              {postComments.length > 0 && (
                <View style={styles.commentsSection}>
                  <Text style={styles.commentsTitle}>Client Comments ({postComments.length})</Text>
                  {postComments.map(c => (
                    <View key={c.id} style={styles.commentItem}>
                      <View style={styles.commentHeader}>
                        <Text style={styles.commentAuthor}>{c.author_name}</Text>
                        <Text style={styles.commentDate}>{format(new Date(c.created_at), 'MMM d, h:mm a')}</Text>
                      </View>
                      <Text style={styles.commentBody}>{c.body}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )
        })}

        {posts.length === 0 && (
          <Text style={{ textAlign: 'center', color: '#888', marginTop: 40 }}>
            No posts mapped for {monthName}.
          </Text>
        )}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Generated {timestamp}</Text>
          <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (
            `Page ${pageNumber} of ${totalPages}`
          )} />
        </View>
      </Page>
    </Document>
  )
}
