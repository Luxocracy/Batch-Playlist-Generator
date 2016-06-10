// Define some variables used to remember state.
var playlistId, channelId;

// After the API loads, call a function to enable the playlist creation form.
function handleAPILoaded() {
  enableForm();
}

// Enable the form for creating a playlist.
function enableForm() {
  $('#playlist-button').attr('disabled', false);
}

// Create a playlist.
function createPlaylist() {
  var title = $('#playlist-title').val();
  var privacyStatus = ($('#playlist-private')[0].checked) ? 'private':'public';
  var request = gapi.client.youtube.playlists.insert({
    part: 'snippet,status',
    resource: {
      snippet: {
        title: title,
        description: 'Playlist generated using the YouTube API via the "Youtube Series Playlist Generator"(https://luxocracy.github.io/YouTube-Series-Playlist-Generator)'
      },
      status: {
        privacyStatus: privacyStatus
      }
    }
  });
  request.execute(function(response) {
    var result = response.result;
    if (result) {
      playlistId = result.id;
      $('#playlist-id').val(playlistId);
      $('#playlist-title').html(result.snippet.title);
      $('#playlist-description').html(result.snippet.description);
    } else {
      $('#status').html('Could not create playlist');
    }
  });
}

function getChannelId(username, callback) {
  var details = {
    part: 'id',
    forUsername: username
  }
  var request = gapi.client.youtube.channels.list(details);
  request.execute(function(response) {
    callback(response.items[0].id);
  });
}

// Add a video ID specified in the form to the playlist.
function searchForVideos() {
  if($('#keywords').val() === "" || $('#channel-id').val() === "") {
    console.error('All fields required.');
    return;
  }
  getChannelId($('#channel-id').val(), function(channelId) {
    videoSearch($('#keywords').val(), channelId, $('#limitToTitle')[0].checked);
  });
}

function videoSearch(keywords, channelId, titleOnly) {
  var result = [];
  var query = function(nextPageToken) {
    var details = {
      q: (titleOnly) ? 'allintitle:"'+ keywords +'"':keywords,
      part: 'snippet',
      type: 'video',
      order: 'date',
      channelId: channelId,
      maxResults: 50
    }

    if(nextPageToken) details['pageToken'] = nextPageToken;

    var request = gapi.client.youtube.search.list(details);
    request.execute(function(response) {
      console.log(response);
      for(var i=0; i < response.items.length; i++) {
        if(!response.items[i].id.videoId) console.log(response.items[i]);
        loopAddToPlaylist.add(response.items[i]);
      }
      if(response.nextPageToken) query(response.nextPageToken);
    });
  }
  query();  // First init
}

var loopAddToPlaylist = {
  queue: [],
  status: null,
  add: function(item) {
    this.queue.push(item);
    if(!this.status) this.execute();
  },
  execute: function() {
    this.status = 'working';
    var video = this.queue.shift();
    // console.log('Video ID:', video);
    addToPlaylist(video.id.videoId, video.snippet, function() {
      if(this.queue.length > 0) {
        this.execute();
      } else {
        console.log('Ran out of video IDs while adding them to the playlist.');
        this.status = null;
      }
    }.bind(this));
  }
}

// Add a video ID specified in the form to the playlist.
function addVideoToPlaylist() {
  addToPlaylist($('#video-id').val());
}

// Add a video to a playlist. The "startPos" and "endPos" values let you
// start and stop the video at specific times when the video is played as
// part of the playlist. However, these values are not set in this example.
function addToPlaylist(videoId, videoSnippet, callback) {
  var details = {
    videoId: videoId,
    kind: 'youtube#video'
  }
  var request = gapi.client.youtube.playlistItems.insert({
    part: 'snippet',
    resource: {
      snippet: {
        playlistId: playlistId,
        resourceId: details
      }
    }
  });
  request.execute(function(response) {
    var container   = $(document.querySelector('template').content).find('.yt-video').clone();
    var thumbnail   = videoSnippet.thumbnails.default;
    var meta        = timeSince(new Date(videoSnippet.publishedAt));

    $(container).find('.yt-thumbnail').append('<img src="'+ thumbnail.url  +'" width="'+ thumbnail.width +'" height="'+ thumbnail.height +'">').end()
    .find('.yt-title').append('<a href="https://www.youtube.com/watch?='+ videoId +'">'+ videoSnippet.title +'</a>').end()
    .find('.yt-channel').append('by <a href="https://www.youtube.com/user/'+ videoSnippet.channelTitle +'">'+ videoSnippet.channelTitle +'</a>').end()
    .find('.yt-meta').append('<span>'+ meta +'</span>').end()
    .find('.yt-description').append('<div>'+ videoSnippet.description +'</div>');

    $('#playlist-container').find('#status').remove().end().prepend(container)
    if(typeof callback === 'function') callback();
  });
}

function timeSince(date) {
  var seconds = Math.floor((new Date() - date) / 1000);
  var interval = 0;

  interval = Math.floor(seconds / 31536000);
  if(interval > 1) {
    return interval + " years ago";
  }
  interval = Math.floor(seconds / 2592000);
  if(interval > 1) {
    return interval + " months ago";
  }
  interval = Math.floor(seconds / 86400);
  if(interval > 1) {
    return interval + " days ago";
  }
  interval = Math.floor(seconds / 3600);
  if(interval > 1) {
    return interval + " hours ago";
  }
  interval = Math.floor(seconds / 60);
  if(interval > 1) {
    return interval + " minutes ago";
  }
  return Math.floor(seconds) + " seconds ago";
}
