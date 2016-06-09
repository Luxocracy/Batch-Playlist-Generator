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
  var request = gapi.client.youtube.playlists.insert({
    part: 'snippet,status',
    resource: {
      snippet: {
        title: 'Test Playlist',
        description: 'A private playlist created with the YouTube API'
      },
      status: {
        privacyStatus: 'private'
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

// Add a video ID specified in the form to the playlist.
function searchForVideos() {
  if($('#keywords').val() === "" || $('#channel-id').val() === "") {
    console.error('All fields required.');
    return;
  }
  videoSearch($('#keywords').val(), $('#channel-id').val());
}

function videoSearch(keywords, channelId) {
  var result = [];
  var query = function(nextPageToken) {
    var details = {
      q: keywords,
      part: 'snippet',
      channelId: channelId,
      maxResults: 5
    }
    if(nextPageToken) details['nextPageToken'] = nextPageToken;
    var request = gapi.client.youtube.search.list(details);
    request.execute(function(response) {
      result = result.concat(response.items)
      // if(response.nextPageToken) {
      //   query(response.nextPageToken);
      // } else {
        for(var i=0; i < result.length; i++) {
          addVideoToPlaylist(result[i].id.videoId);
        }
      // }
    });
  }
  query();
}

// Add a video ID specified in the form to the playlist.
function addVideoToPlaylist() {
  addToPlaylist($('#video-id').val());
}

// Add a video to a playlist. The "startPos" and "endPos" values let you
// start and stop the video at specific times when the video is played as
// part of the playlist. However, these values are not set in this example.
function addToPlaylist(id, startPos, endPos) {
  var details = {
    videoId: id,
    kind: 'youtube#video'
  }
  if (startPos != undefined) {
    details['startAt'] = startPos;
  }
  if (endPos != undefined) {
    details['endAt'] = endPos;
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
    $('#status').html('<pre>' + JSON.stringify(response.result) + '</pre>');
  });
}
