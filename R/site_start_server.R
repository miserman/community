#' @rdname site_build
#' @examples
#' \dontrun{
#' # serve a site that has already been built
#' # from the parent directory of a "docs" directory to be served
#' site_start_server(".")
#' }
#' @export

site_start_server <- function(dir, host = "127.0.0.1", port = 3000) {
  static_path <- list("/" = staticPath(paste0(dir, "/docs"), TRUE))
  server_exists <- FALSE
  for (s in listServers()) {
    if (s$getHost() == host && s$getPort() == port) {
      if (!identical(s$getStaticPaths(), static_path)) {
        stopServer(s)
      } else {
        server_exists <- TRUE
      }
      break
    }
  }
  if (!server_exists) {
    s <- tryCatch(
      startServer(host, port, list(staticPaths = static_path)),
      error = function(e) NULL
    )
    if (is.null(s)) {
      cli_warn(paste0("failed to create server on ", host, ":", port))
    }
  }
  cli_alert_info(paste0("listening on ", host, ":", port))
}
